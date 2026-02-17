"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AllocationEntryType } from "@prisma/client";
import { startOfWeek, parseISO } from "date-fns";
import { getWeeksInRange, getDefaultDateRange } from "@/lib/utils";

// Helper to format dates consistently in UTC to avoid timezone issues
function formatDateUTC(date: Date): string {
  return date.toISOString().split("T")[0];
}

export interface UtilizationData {
  consultants: Array<{
    id: string;
    name: string;
    standardHours: number;
    roles: string[];
    groups: string[];
  }>;
  weeks: string[]; // ISO date strings of week starts
  allocations: Record<string, Record<string, {
    actual: number;
    projected: number;
    details: Array<{
      projectId: string;
      projectName: string;
      timecode: string;
      hours: number;
      entryType: AllocationEntryType;
      notes: string | null;
      createdBy: string | null;
      updatedAt: Date;
    }>;
  }>>;
}

export async function getUtilizationData(
  startDate?: string,
  endDate?: string
): Promise<UtilizationData> {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const defaultRange = getDefaultDateRange();
  const start = startDate ? parseISO(startDate) : defaultRange.start;
  const end = endDate ? parseISO(endDate) : defaultRange.end;

  const weeks = getWeeksInRange(start, end);
  const weekStrings = weeks.map((w) => formatDateUTC(w));

  // Get all consultants with their roles and groups
  const consultants = await prisma.consultant.findMany({
    include: {
      roles: true,
      groups: true,
    },
    orderBy: { name: "asc" },
  });

  // Get all allocations in the date range
  const allocations = await prisma.allocation.findMany({
    where: {
      weekStart: {
        gte: start,
        lte: end,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
          timecode: true,
        },
      },
      createdBy: {
        select: {
          email: true,
        },
      },
    },
  });

  // Build the allocation map
  const allocationMap: UtilizationData["allocations"] = {};

  for (const consultant of consultants) {
    allocationMap[consultant.id] = {};
    for (const week of weekStrings) {
      allocationMap[consultant.id][week] = {
        actual: 0,
        projected: 0,
        details: [],
      };
    }
  }

  for (const allocation of allocations) {
    const weekKey = formatDateUTC(allocation.weekStart);
    const consultantId = allocation.consultantId;

    if (allocationMap[consultantId] && allocationMap[consultantId][weekKey]) {
      const cell = allocationMap[consultantId][weekKey];
      
      if (allocation.entryType === AllocationEntryType.ACTUAL) {
        cell.actual += allocation.hours;
      } else {
        cell.projected += allocation.hours;
      }

      cell.details.push({
        projectId: allocation.project.id,
        projectName: allocation.project.projectName,
        timecode: allocation.project.timecode,
        hours: allocation.hours,
        entryType: allocation.entryType,
        notes: allocation.notes,
        createdBy: allocation.createdBy?.email || null,
        updatedAt: allocation.updatedAt,
      });
    }
  }

  return {
    consultants: consultants.map((c) => ({
      id: c.id,
      name: c.name,
      standardHours: c.standardHours,
      roles: c.roles.map((r) => r.level),
      groups: c.groups.map((g) => g.group),
    })),
    weeks: weekStrings,
    allocations: allocationMap,
  };
}

export async function updateAllocation(
  consultantId: string,
  weekStart: string,
  projectId: string,
  hours: number,
  entryType: AllocationEntryType,
  notes?: string
) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Employees can only edit their own allocations
  if (session.user.role === "EMPLOYEE" && session.user.consultantId !== consultantId) {
    throw new Error("You can only edit your own allocations");
  }

  const weekDate = startOfWeek(parseISO(weekStart), { weekStartsOn: 0 });

  // Verify user exists in database (handles stale sessions after db reset)
  let createdById: string | null = null;
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user) {
      createdById = user.id;
    }
  } catch {
    // User doesn't exist, proceed without createdById
  }

  const allocation = await prisma.allocation.upsert({
    where: {
      consultantId_projectId_weekStart_entryType: {
        consultantId,
        projectId,
        weekStart: weekDate,
        entryType,
      },
    },
    update: {
      hours,
      notes,
    },
    create: {
      consultantId,
      projectId,
      weekStart: weekDate,
      hours,
      entryType,
      notes,
      createdById,
    },
  });

  revalidatePath("/utilization");
  return allocation;
}

export async function deleteAllocation(
  consultantId: string,
  projectId: string,
  weekStart: string,
  entryType: AllocationEntryType
) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (session.user.role === "EMPLOYEE" && session.user.consultantId !== consultantId) {
    throw new Error("You can only delete your own allocations");
  }

  const weekDate = startOfWeek(parseISO(weekStart), { weekStartsOn: 0 });

  await prisma.allocation.delete({
    where: {
      consultantId_projectId_weekStart_entryType: {
        consultantId,
        projectId,
        weekStart: weekDate,
        entryType,
      },
    },
  });

  revalidatePath("/utilization");
}
