"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AllocationEntryType } from "@prisma/client";

export type Risk = {
  id: string;
  description: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  mitigation: string;
  owner: string;
};

export type ActionItem = {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: "OPEN" | "DONE" | "BLOCKED";
};

export type ProjectReportData = {
  id: string;
  projectId: string;
  reportNumber: number;
  periodStart: Date;
  periodEnd: Date;
  isFinalized: boolean;
  finalizedAt: Date | null;
  highlights: string | null;
  upcomingWork: string | null;
  risks: Risk[];
  actionItems: ActionItem[];
  createdAt: Date;
  updatedAt: Date;
};

function parseReportJson(report: {
  id: string;
  projectId: string;
  reportNumber: number;
  periodStart: Date;
  periodEnd: Date;
  isFinalized: boolean;
  finalizedAt: Date | null;
  highlights: string | null;
  upcomingWork: string | null;
  risks: unknown;
  actionItems: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ProjectReportData {
  return {
    ...report,
    risks: Array.isArray(report.risks) ? (report.risks as Risk[]) : [],
    actionItems: Array.isArray(report.actionItems) ? (report.actionItems as ActionItem[]) : [],
  };
}

export async function getProjectReports(projectId: string): Promise<ProjectReportData[]> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const reports = await prisma.projectReport.findMany({
    where: { projectId },
    orderBy: { reportNumber: "desc" },
  });

  return reports.map(parseReportJson);
}

export async function createProjectReport(
  projectId: string,
  data: { periodStart: string; periodEnd: string; copyFromReportId?: string }
): Promise<ProjectReportData> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const lastReport = await prisma.projectReport.findFirst({
    where: { projectId },
    orderBy: { reportNumber: "desc" },
  });

  const reportNumber = (lastReport?.reportNumber ?? 0) + 1;

  let highlights: string | null = null;
  let upcomingWork: string | null = null;
  let risks: Risk[] = [];
  let actionItems: ActionItem[] = [];

  if (data.copyFromReportId) {
    const source = await prisma.projectReport.findUnique({
      where: { id: data.copyFromReportId },
    });
    if (source) {
      highlights = source.highlights;
      upcomingWork = source.upcomingWork;
      risks = Array.isArray(source.risks) ? (source.risks as Risk[]) : [];
      actionItems = Array.isArray(source.actionItems)
        ? (source.actionItems as ActionItem[]).filter((ai) => ai.status !== "DONE")
        : [];
    }
  }

  const report = await prisma.projectReport.create({
    data: {
      projectId,
      reportNumber,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      highlights,
      upcomingWork,
      risks: risks as object[],
      actionItems: actionItems as object[],
    },
  });

  revalidatePath(`/projects/${projectId}/report`);
  return parseReportJson(report);
}

export async function updateProjectReport(
  reportId: string,
  data: {
    highlights?: string;
    upcomingWork?: string;
    risks?: Risk[];
    actionItems?: ActionItem[];
  }
): Promise<ProjectReportData> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const report = await prisma.projectReport.update({
    where: { id: reportId },
    data: {
      ...(data.highlights !== undefined && { highlights: data.highlights }),
      ...(data.upcomingWork !== undefined && { upcomingWork: data.upcomingWork }),
      ...(data.risks !== undefined && { risks: data.risks as object[] }),
      ...(data.actionItems !== undefined && { actionItems: data.actionItems as object[] }),
    },
  });

  revalidatePath(`/projects/${report.projectId}/report`);
  return parseReportJson(report);
}

export async function finalizeProjectReport(reportId: string): Promise<ProjectReportData> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const report = await prisma.projectReport.update({
    where: { id: reportId },
    data: { isFinalized: true, finalizedAt: new Date() },
  });

  revalidatePath(`/projects/${report.projectId}/report`);
  return parseReportJson(report);
}

export type ProjectReportContext = {
  id: string;
  client: string;
  projectName: string;
  budget: number | null;
  currency: string;
  healthStatus: string | null;
  startDate: Date | null;
  endDate: Date | null;
  projectManager: { name: string } | null;
  budgetSpent: number;
  scheduleStatus: "ON_TRACK" | "AT_RISK" | "BEHIND" | "NOT_SET";
  overallProgress: number;
};

export async function getProjectReportContext(projectId: string): Promise<ProjectReportContext> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectManager: { select: { name: true } },
      members: { select: { consultantId: true, billingRate: true } },
    },
  });

  if (!project) throw new Error("Project not found");

  // Budget spent: sum ACTUAL allocation hours × billing rate
  const actualAllocations = await prisma.allocation.findMany({
    where: { projectId, entryType: AllocationEntryType.ACTUAL },
    select: { consultantId: true, hours: true },
  });

  const billingRateMap = new Map(
    project.members
      .filter((m) => m.billingRate != null)
      .map((m) => [m.consultantId, m.billingRate!])
  );

  const budgetSpent = actualAllocations.reduce((sum, alloc) => {
    const rate = billingRateMap.get(alloc.consultantId) ?? 0;
    return sum + alloc.hours * rate;
  }, 0);

  // Schedule status + progress from schedule items
  const scheduleItems = await prisma.projectScheduleItem.findMany({
    where: { projectId },
  });

  const tasks = scheduleItems.filter((i) => i.type === "TASK");

  let scheduleStatus: "ON_TRACK" | "AT_RISK" | "BEHIND" | "NOT_SET" = "NOT_SET";
  let overallProgress = 0;

  if (tasks.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let behindCount = 0;
    let atRiskCount = 0;

    for (const task of tasks) {
      if (!task.endDate || task.percentComplete >= 100) continue;
      const endDate = new Date(task.endDate);
      const daysOverdue = Math.floor((today.getTime() - endDate.getTime()) / 86400000);
      if (daysOverdue > 7) behindCount++;
      else if (daysOverdue > 0) atRiskCount++;
    }

    scheduleStatus = behindCount > 0 ? "BEHIND" : atRiskCount > 0 ? "AT_RISK" : "ON_TRACK";
    overallProgress = Math.round(
      tasks.reduce((sum, t) => sum + t.percentComplete, 0) / tasks.length
    );
  }

  return {
    id: project.id,
    client: project.client,
    projectName: project.projectName,
    budget: project.budget,
    currency: project.currency,
    healthStatus: project.healthStatus,
    startDate: project.startDate,
    endDate: project.endDate,
    projectManager: project.projectManager,
    budgetSpent,
    scheduleStatus,
    overallProgress,
  };
}
