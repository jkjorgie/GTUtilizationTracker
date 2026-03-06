"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startOfWeek, addWeeks, parseISO } from "date-fns";
import { AllocationEntryType } from "@prisma/client";

export async function getProjectMembers(projectId: string) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Get all consultants who have allocations on this project
  const allocations = await prisma.allocation.findMany({
    where: { projectId },
    select: {
      consultantId: true,
      consultant: { select: { id: true, name: true } },
    },
    distinct: ["consultantId"],
  });

  // Get explicitly-set ProjectMember records for this project
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      consultant: { select: { id: true, name: true } },
      roleDefinition: { select: { id: true, name: true, msrpRate: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const memberConsultantIds = new Set(members.map((m) => m.consultantId));

  // Merge: start with explicitly-added members, then add allocation-only consultants
  const result: Array<{
    consultantId: string;
    consultantName: string;
    memberId: string | null;
    roleDefinitionId: string | null;
    roleDefinitionName: string | null;
    msrpRate: number | null;
    billingRate: number | null;
    fromAllocation: boolean;
  }> = [];

  // Explicitly added members first (all rows, including duplicates)
  for (const member of members) {
    result.push({
      consultantId: member.consultantId,
      consultantName: member.consultant.name,
      memberId: member.id,
      roleDefinitionId: member.roleDefinitionId,
      roleDefinitionName: member.roleDefinition?.name ?? null,
      msrpRate: member.roleDefinition?.msrpRate ?? null,
      billingRate: member.billingRate,
      fromAllocation: false,
    });
  }

  // Add allocation-only consultants (not yet explicitly added)
  for (const alloc of allocations) {
    if (!memberConsultantIds.has(alloc.consultantId)) {
      result.push({
        consultantId: alloc.consultantId,
        consultantName: alloc.consultant.name,
        memberId: null,
        roleDefinitionId: null,
        roleDefinitionName: null,
        msrpRate: null,
        billingRate: null,
        fromAllocation: true,
      });
    }
  }

  return result.sort((a, b) => a.consultantName.localeCompare(b.consultantName));
}

export async function createProjectMember(
  projectId: string,
  consultantId: string,
  roleDefinitionId: string | null,
  billingRate: number | null
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      consultantId,
      roleDefinitionId: roleDefinitionId || null,
      billingRate: billingRate ?? null,
    },
    include: {
      consultant: { select: { id: true, name: true } },
      roleDefinition: { select: { id: true, name: true, msrpRate: true } },
    },
  });

  revalidatePath("/projects");
  return member;
}

export async function updateProjectMember(
  memberId: string,
  roleDefinitionId: string | null,
  billingRate: number | null
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const member = await prisma.projectMember.update({
    where: { id: memberId },
    data: {
      roleDefinitionId: roleDefinitionId || null,
      billingRate: billingRate ?? null,
    },
    include: {
      consultant: { select: { id: true, name: true } },
      roleDefinition: { select: { id: true, name: true, msrpRate: true } },
    },
  });

  revalidatePath("/projects");
  return member;
}

export async function removeProjectMember(memberId: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.projectMember.delete({
    where: { id: memberId },
  });

  revalidatePath("/projects");
}

/**
 * Seeds PROJECTED allocation rows for a consultant on a project,
 * one per week (Sunday) in [fromDate, toDate], with weeklyHours each.
 * Existing rows are updated (upsert), so it's safe to call multiple times.
 */
export async function seedMemberAllocations(
  projectId: string,
  consultantId: string,
  weeklyHours: number,
  fromDate: string,
  toDate: string
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const from = startOfWeek(parseISO(fromDate), { weekStartsOn: 0 });
  const to = parseISO(toDate);

  const weeks: Date[] = [];
  let current = from;
  while (current <= to) {
    weeks.push(new Date(current));
    current = addWeeks(current, 1);
  }

  if (weeks.length === 0) return;

  await prisma.$transaction(
    weeks.map((weekStart) =>
      prisma.allocation.upsert({
        where: {
          consultantId_projectId_weekStart_entryType: {
            consultantId,
            projectId,
            weekStart,
            entryType: AllocationEntryType.PROJECTED,
          },
        },
        update: { hours: weeklyHours },
        create: {
          consultantId,
          projectId,
          weekStart,
          hours: weeklyHours,
          entryType: AllocationEntryType.PROJECTED,
        },
      })
    )
  );

  revalidatePath("/");
}
