"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GroupType, RoleLevel, OvertimePreference } from "@prisma/client";

const consultantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  standardHours: z.number().min(0).max(80),
  overtimePreference: z.nativeEnum(OvertimePreference),
  overtimeHoursAvailable: z.number().min(0).max(40),
  hrManager: z.string().optional(),
  groups: z.array(z.nativeEnum(GroupType)).min(1, "At least one group is required"),
  roles: z.array(z.nativeEnum(RoleLevel)).min(1, "At least one role is required"),
});

export type ConsultantFormData = z.infer<typeof consultantSchema>;

export async function getConsultants(filters?: {
  group?: GroupType;
  role?: RoleLevel;
  search?: string;
}) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const where: {
    groups?: { some: { group: GroupType } };
    roles?: { some: { level: RoleLevel } };
    name?: { contains: string; mode: "insensitive" };
  } = {};

  if (filters?.group) {
    where.groups = { some: { group: filters.group } };
  }

  if (filters?.role) {
    where.roles = { some: { level: filters.role } };
  }

  if (filters?.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return prisma.consultant.findMany({
    where,
    include: {
      groups: true,
      roles: true,
      user: {
        select: { email: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getConsultant(id: string) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return prisma.consultant.findUnique({
    where: { id },
    include: {
      groups: true,
      roles: true,
    },
  });
}

export async function createConsultant(data: ConsultantFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = consultantSchema.parse(data);

  const consultant = await prisma.consultant.create({
    data: {
      name: validated.name,
      standardHours: validated.standardHours,
      overtimePreference: validated.overtimePreference,
      overtimeHoursAvailable: validated.overtimeHoursAvailable,
      hrManager: validated.hrManager,
      groups: {
        create: validated.groups.map((group) => ({ group })),
      },
      roles: {
        create: validated.roles.map((level) => ({ level })),
      },
    },
    include: {
      groups: true,
      roles: true,
    },
  });

  revalidatePath("/consultants");
  return consultant;
}

export async function updateConsultant(id: string, data: ConsultantFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = consultantSchema.parse(data);

  // Delete existing groups and roles, then recreate
  await prisma.$transaction([
    prisma.consultantGroup.deleteMany({ where: { consultantId: id } }),
    prisma.consultantRole.deleteMany({ where: { consultantId: id } }),
  ]);

  const consultant = await prisma.consultant.update({
    where: { id },
    data: {
      name: validated.name,
      standardHours: validated.standardHours,
      overtimePreference: validated.overtimePreference,
      overtimeHoursAvailable: validated.overtimeHoursAvailable,
      hrManager: validated.hrManager,
      groups: {
        create: validated.groups.map((group) => ({ group })),
      },
      roles: {
        create: validated.roles.map((level) => ({ level })),
      },
    },
    include: {
      groups: true,
      roles: true,
    },
  });

  revalidatePath("/consultants");
  return consultant;
}

export async function deleteConsultant(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Check if consultant has any allocations
  const allocations = await prisma.allocation.count({
    where: { consultantId: id },
  });

  if (allocations > 0) {
    throw new Error(
      "Cannot delete consultant with existing allocations."
    );
  }

  await prisma.consultant.delete({
    where: { id },
  });

  revalidatePath("/consultants");
}

export async function getAllConsultants() {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return prisma.consultant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      standardHours: true,
    },
  });
}
