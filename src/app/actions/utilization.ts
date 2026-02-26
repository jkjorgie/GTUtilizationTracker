"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AllocationEntryType, ProjectStatus } from "@prisma/client";
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
    billingRoleIds: string[];
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
  consultantProjects: Record<string, Array<{ projectId: string; projectName: string; timecode: string }>>;
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

  // Build consultant filter based on role
  const consultantWhere: Record<string, unknown> = {};
  if (session.user.role === "EMPLOYEE") {
    if (!session.user.consultantId) {
      return { consultants: [], weeks: weekStrings, allocations: {}, consultantProjects: {} };
    }
    consultantWhere.id = session.user.consultantId;
  } else if (session.user.role === "MANAGER") {
    if (!session.user.consultantId) {
      return { consultants: [], weeks: weekStrings, allocations: {}, consultantProjects: {} };
    }
    consultantWhere.managerId = session.user.consultantId;
  }
  // ADMIN: no filter, sees everyone

  const consultants = await prisma.consultant.findMany({
    where: consultantWhere,
    include: {
      groups: true,
      billingRoles: {
        include: {
          roleDefinition: { select: { name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const visibleConsultantIds = consultants.map(c => c.id);

  // Get allocations in the date range for visible consultants.
  // - ACTUAL allocations: shown for all projects (including inactive)
  // - PROJECTED allocations: only shown for active projects
  const allocations = await prisma.allocation.findMany({
    where: {
      consultantId: { in: visibleConsultantIds },
      weekStart: { gte: start, lte: end },
      OR: [
        { entryType: AllocationEntryType.ACTUAL },
        { entryType: AllocationEntryType.PROJECTED, project: { status: ProjectStatus.ACTIVE } },
      ],
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

  // Get distinct consultant-project pairs for active projects (visible consultants only)
  const consultantProjectAssocs = await prisma.allocation.findMany({
    where: {
      consultantId: { in: visibleConsultantIds },
      project: {
        status: ProjectStatus.ACTIVE,
      },
    },
    select: {
      consultantId: true,
      project: {
        select: {
          id: true,
          projectName: true,
          timecode: true,
        },
      },
    },
    distinct: ['consultantId', 'projectId'],
  });

  const consultantProjectsMap: Record<string, Array<{ projectId: string; projectName: string; timecode: string }>> = {};
  for (const assoc of consultantProjectAssocs) {
    if (!consultantProjectsMap[assoc.consultantId]) {
      consultantProjectsMap[assoc.consultantId] = [];
    }
    consultantProjectsMap[assoc.consultantId].push({
      projectId: assoc.project.id,
      projectName: assoc.project.projectName,
      timecode: assoc.project.timecode,
    });
  }
  for (const id of Object.keys(consultantProjectsMap)) {
    consultantProjectsMap[id].sort((a, b) => a.timecode.localeCompare(b.timecode));
  }

  return {
    consultants: consultants.map((c) => ({
      id: c.id,
      name: c.name,
      standardHours: c.standardHours,
      roles: c.billingRoles.map((br) => br.roleDefinition.name),
      billingRoleIds: c.billingRoles.map((br) => br.roleDefinitionId),
      groups: c.groups.map((g) => g.group),
    })),
    weeks: weekStrings,
    allocations: allocationMap,
    consultantProjects: consultantProjectsMap,
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

  if (session.user.role === "EMPLOYEE" && session.user.consultantId !== consultantId) {
    throw new Error("You can only edit your own allocations");
  }

  if (session.user.role === "MANAGER") {
    const target = await prisma.consultant.findUnique({
      where: { id: consultantId },
      select: { managerId: true },
    });
    if (target?.managerId !== session.user.consultantId) {
      throw new Error("You can only edit allocations for your direct reports");
    }
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

  if (session.user.role === "MANAGER") {
    const target = await prisma.consultant.findUnique({
      where: { id: consultantId },
      select: { managerId: true },
    });
    if (target?.managerId !== session.user.consultantId) {
      throw new Error("You can only delete allocations for your direct reports");
    }
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
