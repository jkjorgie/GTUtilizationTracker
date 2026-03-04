"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AllocationEntryType, ProjectStatus, ProjectType } from "@prisma/client";
import { startOfWeek, subWeeks, addWeeks, eachWeekOfInterval, format, isBefore } from "date-fns";
import { getSystemSetting } from "./system-settings";

function formatWeek(date: Date): string {
  return format(date, "M/d");
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export type DashboardReportData = {
  utilizationTrend: Array<{ week: string; actual: number; projected: number }>;
  availableCapacity: Array<{ week: string; available: number; standard: number }>;
  billableActuals: Array<{ week: string; hours: number }>;
  projectHealth: { red: number; yellow: number; green: number; none: number };
  projectBudgets: Array<{
    projectName: string;
    client: string;
    timecode: string;
    budget: number | null;
    totalActualHours: number;
    health: string | null;
  }>;
  revenueForecast: { upcomingMsrp: number; periodCount: number };
  trainingHours: Array<{ week: string; hours: number }>;
  overheadHours: Array<{ week: string; hours: number }>;
  upcomingPTO: Array<{ week: string; hours: number }>;
  trainingTimecodes: string[];
  overheadTimecodes: string[];
};

export async function getDashboardReportData(options: {
  weeksBack: number;
  weeksForward: number;
}): Promise<DashboardReportData> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const { weeksBack, weeksForward } = options;
  const role = session.user.role;

  // Compute date range
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const rangeStart = subWeeks(currentWeekStart, weeksBack);
  const rangeEnd = addWeeks(currentWeekStart, weeksForward);

  const allWeeks = eachWeekOfInterval(
    { start: rangeStart, end: rangeEnd },
    { weekStartsOn: 0 }
  );
  const weekLabels = allWeeks.map((w) => formatWeek(w));
  const weekIsos = allWeeks.map((w) => isoDate(w));

  // Role-scoped consultant filter
  const consultantWhere: Record<string, unknown> = {};
  if (role === "EMPLOYEE") {
    if (!session.user.consultantId) return emptyReport(weekLabels);
    consultantWhere.id = session.user.consultantId;
  } else if (role === "MANAGER") {
    if (!session.user.consultantId) return emptyReport(weekLabels);
    // Managers see their direct reports
    consultantWhere.managerId = session.user.consultantId;
  }

  // Fetch scoped consultants
  const consultants = await prisma.consultant.findMany({
    where: consultantWhere,
    select: { id: true, standardHours: true },
  });
  const consultantIds = consultants.map((c) => c.id);
  const totalStandardPerWeek = consultants.reduce((s, c) => s + c.standardHours, 0);

  // Fetch all allocations in range for scoped consultants
  const allocations = await prisma.allocation.findMany({
    where: {
      consultantId: { in: consultantIds },
      weekStart: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      project: { select: { type: true, timecode: true, status: true } },
    },
  });

  // --- Utilization Trend ---
  const actualByWeek = new Map<string, number>();
  const projectedByWeek = new Map<string, number>();
  for (const w of weekIsos) {
    actualByWeek.set(w, 0);
    projectedByWeek.set(w, 0);
  }
  for (const a of allocations) {
    const wk = isoDate(a.weekStart);
    if (a.entryType === AllocationEntryType.ACTUAL) {
      actualByWeek.set(wk, (actualByWeek.get(wk) ?? 0) + a.hours);
    } else {
      projectedByWeek.set(wk, (projectedByWeek.get(wk) ?? 0) + a.hours);
    }
  }
  const utilizationTrend = allWeeks.map((w, i) => {
    const wk = isoDate(w);
    return {
      week: weekLabels[i],
      actual: Math.round((actualByWeek.get(wk) ?? 0) * 10) / 10,
      projected: Math.round((projectedByWeek.get(wk) ?? 0) * 10) / 10,
    };
  });

  // --- Available Capacity (current week and future only) ---
  const availableCapacity = allWeeks
    .map((w, i) => {
      if (isBefore(w, currentWeekStart)) return null;
      const wk = isoDate(w);
      const allocated = projectedByWeek.get(wk) ?? 0;
      const available = Math.max(0, totalStandardPerWeek - allocated);
      return {
        week: weekLabels[i],
        available: Math.round(available * 10) / 10,
        standard: totalStandardPerWeek,
      };
    })
    .filter(Boolean) as DashboardReportData["availableCapacity"];

  // --- Billable Actuals Trend (admin + manager) ---
  const billableActualsByWeek = new Map<string, number>();
  for (const w of weekIsos) billableActualsByWeek.set(w, 0);
  for (const a of allocations) {
    if (
      a.entryType === AllocationEntryType.ACTUAL &&
      a.project.type === ProjectType.BILLABLE
    ) {
      const wk = isoDate(a.weekStart);
      billableActualsByWeek.set(wk, (billableActualsByWeek.get(wk) ?? 0) + a.hours);
    }
  }
  const billableActuals = allWeeks.map((w, i) => ({
    week: weekLabels[i],
    hours: Math.round((billableActualsByWeek.get(isoDate(w)) ?? 0) * 10) / 10,
  }));

  // --- Project Health (admin + manager) ---
  let projectHealth = { red: 0, yellow: 0, green: 0, none: 0 };
  if (role !== "EMPLOYEE") {
    const healthGroups = await prisma.project.groupBy({
      by: ["healthStatus"],
      where: { status: ProjectStatus.ACTIVE },
      _count: { id: true },
    });
    for (const g of healthGroups) {
      if (g.healthStatus === "RED") projectHealth.red = g._count.id;
      else if (g.healthStatus === "YELLOW") projectHealth.yellow = g._count.id;
      else if (g.healthStatus === "GREEN") projectHealth.green = g._count.id;
      else projectHealth.none += g._count.id;
    }
  }

  // --- Project Budgets (admin only) ---
  let projectBudgets: DashboardReportData["projectBudgets"] = [];
  if (role === "ADMIN") {
    const activeProjects = await prisma.project.findMany({
      where: { status: ProjectStatus.ACTIVE },
      select: {
        id: true,
        projectName: true,
        client: true,
        timecode: true,
        budget: true,
        healthStatus: true,
        allocations: {
          where: { entryType: AllocationEntryType.ACTUAL },
          select: { hours: true },
        },
      },
      orderBy: { client: "asc" },
    });
    projectBudgets = activeProjects.map((p) => ({
      projectName: p.projectName,
      client: p.client,
      timecode: p.timecode,
      budget: p.budget,
      totalActualHours: p.allocations.reduce((s, a) => s + a.hours, 0),
      health: p.healthStatus,
    }));
  }

  // --- Revenue Forecast (admin only) ---
  let revenueForecast = { upcomingMsrp: 0, periodCount: 0 };
  if (role === "ADMIN") {
    const futureAllocations = await prisma.allocation.findMany({
      where: {
        weekStart: { gte: currentWeekStart },
        entryType: AllocationEntryType.PROJECTED,
        project: { type: ProjectType.BILLABLE, status: ProjectStatus.ACTIVE },
      },
      include: {
        project: {
          select: {
            members: {
              select: {
                consultantId: true,
                roleDefinition: { select: { msrpRate: true } },
              },
            },
          },
        },
      },
    });

    // Build member → msrpRate lookup per project
    const msrpByConsultantProject = new Map<string, number>();
    for (const a of futureAllocations) {
      const key = `${a.projectId}_${a.consultantId}`;
      if (!msrpByConsultantProject.has(key)) {
        const member = a.project.members.find((m) => m.consultantId === a.consultantId);
        msrpByConsultantProject.set(key, member?.roleDefinition?.msrpRate ?? 0);
      }
    }

    const weekSet = new Set<string>();
    let totalMsrp = 0;
    for (const a of futureAllocations) {
      const msrp = msrpByConsultantProject.get(`${a.projectId}_${a.consultantId}`) ?? 0;
      totalMsrp += a.hours * msrp;
      weekSet.add(isoDate(a.weekStart));
    }
    // Convert weeks to approximate billing periods (every 2 weeks)
    revenueForecast = {
      upcomingMsrp: Math.round(totalMsrp),
      periodCount: Math.ceil(weekSet.size / 2),
    };
  }

  // --- Training & Overhead Costs (admin + manager) ---
  const trainingStr = (await getSystemSetting("TRAINING_TIMECODES")) ?? "";
  const overheadStr = (await getSystemSetting("OVERHEAD_TIMECODES")) ?? "";
  const trainingTimecodes = trainingStr
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const overheadTimecodes = overheadStr
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const trainingHoursMap = new Map<string, number>();
  const overheadHoursMap = new Map<string, number>();
  for (const w of weekIsos) {
    trainingHoursMap.set(w, 0);
    overheadHoursMap.set(w, 0);
  }

  if (role !== "EMPLOYEE" && (trainingTimecodes.length > 0 || overheadTimecodes.length > 0)) {
    const specialAllocations = await prisma.allocation.findMany({
      where: {
        weekStart: { gte: rangeStart, lte: rangeEnd },
        project: {
          timecode: {
            in: [...trainingTimecodes, ...overheadTimecodes],
          },
        },
      },
      include: { project: { select: { timecode: true } } },
    });

    for (const a of specialAllocations) {
      const tc = a.project.timecode.toUpperCase();
      const wk = isoDate(a.weekStart);
      if (trainingTimecodes.includes(tc)) {
        trainingHoursMap.set(wk, (trainingHoursMap.get(wk) ?? 0) + a.hours);
      }
      if (overheadTimecodes.includes(tc)) {
        overheadHoursMap.set(wk, (overheadHoursMap.get(wk) ?? 0) + a.hours);
      }
    }
  }

  const trainingHours = allWeeks.map((w, i) => ({
    week: weekLabels[i],
    hours: Math.round((trainingHoursMap.get(isoDate(w)) ?? 0) * 10) / 10,
  }));
  const overheadHours = allWeeks.map((w, i) => ({
    week: weekLabels[i],
    hours: Math.round((overheadHoursMap.get(isoDate(w)) ?? 0) * 10) / 10,
  }));

  // --- Upcoming PTO Impact ---
  // Approved PTO requests that overlap with future weeks
  const ptoWhere: Record<string, unknown> = {
    status: "APPROVED",
    endDate: { gte: currentWeekStart },
  };
  if (role === "EMPLOYEE" && session.user.consultantId) {
    ptoWhere.consultantId = session.user.consultantId;
  } else if (role === "MANAGER" && session.user.consultantId) {
    ptoWhere.consultant = { managerId: session.user.consultantId };
  }

  const ptoRequests = await prisma.pTORequest.findMany({
    where: ptoWhere,
    include: {
      consultant: { select: { standardHours: true } },
    },
  });

  const ptoByWeek = new Map<string, number>();
  for (const w of weekIsos) ptoByWeek.set(w, 0);

  for (const pto of ptoRequests) {
    const dailyHours = pto.allDay
      ? (pto.consultant.standardHours ?? 40) / 5
      : parseTimeRange(pto.startTime, pto.endTime);

    // Walk each day in the PTO range and bucket into weeks
    const start = new Date(pto.startDate);
    const end = new Date(pto.endDate);
    const cur = new Date(start);
    while (cur <= end) {
      const dayOfWeek = cur.getUTCDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Weekday — find its week start
        const weekStart = startOfWeek(cur, { weekStartsOn: 0 });
        const wk = isoDate(weekStart);
        if (ptoByWeek.has(wk)) {
          ptoByWeek.set(wk, (ptoByWeek.get(wk) ?? 0) + dailyHours);
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const upcomingPTO = allWeeks
    .map((w, i) => {
      if (isBefore(w, currentWeekStart)) return null;
      return {
        week: weekLabels[i],
        hours: Math.round((ptoByWeek.get(isoDate(w)) ?? 0) * 10) / 10,
      };
    })
    .filter(Boolean) as DashboardReportData["upcomingPTO"];

  return {
    utilizationTrend,
    availableCapacity,
    billableActuals,
    projectHealth,
    projectBudgets,
    revenueForecast,
    trainingHours,
    overheadHours,
    upcomingPTO,
    trainingTimecodes,
    overheadTimecodes,
  };
}

function parseTimeRange(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 8;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function emptyReport(weekLabels: string[]): DashboardReportData {
  const empty = weekLabels.map((w) => ({ week: w, hours: 0 }));
  return {
    utilizationTrend: weekLabels.map((w) => ({ week: w, actual: 0, projected: 0 })),
    availableCapacity: weekLabels.map((w) => ({ week: w, available: 0, standard: 0 })),
    billableActuals: empty,
    projectHealth: { red: 0, yellow: 0, green: 0, none: 0 },
    projectBudgets: [],
    revenueForecast: { upcomingMsrp: 0, periodCount: 0 },
    trainingHours: empty,
    overheadHours: empty,
    upcomingPTO: empty,
    trainingTimecodes: [],
    overheadTimecodes: [],
  };
}
