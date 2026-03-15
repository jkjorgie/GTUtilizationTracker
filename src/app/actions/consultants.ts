"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GroupType, OvertimePreference } from "@prisma/client";
import { encrypt, encryptNullable, decrypt, decryptNullable } from "@/lib/encryption";

const consultantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  netSuiteName: z.string().optional().nullable(),
  standardHours: z.number().min(0).max(80),
  overtimePreference: z.nativeEnum(OvertimePreference),
  overtimeHoursAvailable: z.number().min(0).max(40),
  managerId: z.string().optional().nullable(),
  groups: z.array(z.nativeEnum(GroupType)).min(1, "At least one group is required"),
  billingRoleIds: z.array(z.string()).min(1, "At least one billing role is required"),
});

export type ConsultantFormData = z.infer<typeof consultantSchema>;

function decryptConsultantFields<T extends { name: string; netSuiteName?: string | null }>(c: T): T {
  return { ...c, name: decrypt(c.name), netSuiteName: decryptNullable(c.netSuiteName) };
}

export async function getConsultants(filters?: {
  group?: GroupType;
  billingRoleId?: string;
  search?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const where: {
    groups?: { some: { group: GroupType } };
    billingRoles?: { some: { roleDefinitionId: string } };
  } = {};

  if (filters?.group) where.groups = { some: { group: filters.group } };
  if (filters?.billingRoleId) where.billingRoles = { some: { roleDefinitionId: filters.billingRoleId } };

  // Search is done in-memory after decryption — SQL LIKE does not work on encrypted values
  const results = await prisma.consultant.findMany({
    where,
    include: {
      groups: true,
      billingRoles: { include: { roleDefinition: { select: { id: true, name: true } } } },
      manager: { select: { id: true, name: true } },
      user: { select: { email: true } },
    },
  });

  const decrypted = results.map((c) => ({
    ...c,
    name: decrypt(c.name),
    netSuiteName: decryptNullable(c.netSuiteName),
    manager: c.manager ? { ...c.manager, name: decrypt(c.manager.name) } : null,
  }));

  const filtered = filters?.search
    ? decrypted.filter((c) => c.name.toLowerCase().includes(filters.search!.toLowerCase()))
    : decrypted;

  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getConsultant(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const c = await prisma.consultant.findUnique({
    where: { id },
    include: {
      groups: true,
      billingRoles: { include: { roleDefinition: { select: { id: true, name: true } } } },
      manager: { select: { id: true, name: true } },
    },
  });

  if (!c) return null;
  return {
    ...c,
    name: decrypt(c.name),
    netSuiteName: decryptNullable(c.netSuiteName),
    manager: c.manager ? { ...c.manager, name: decrypt(c.manager.name) } : null,
  };
}

export async function createConsultant(data: ConsultantFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const validated = consultantSchema.parse(data);

  const consultant = await prisma.consultant.create({
    data: {
      name: encrypt(validated.name),
      netSuiteName: encryptNullable(validated.netSuiteName || null),
      standardHours: validated.standardHours,
      overtimePreference: validated.overtimePreference,
      overtimeHoursAvailable: validated.overtimeHoursAvailable,
      managerId: validated.managerId || null,
      groups: { create: validated.groups.map((group) => ({ group })) },
      billingRoles: { create: validated.billingRoleIds.map((roleDefinitionId) => ({ roleDefinitionId })) },
    },
    include: {
      groups: true,
      billingRoles: { include: { roleDefinition: { select: { id: true, name: true } } } },
    },
  });

  revalidatePath("/consultants");
  return decryptConsultantFields(consultant);
}

export async function updateConsultant(id: string, data: ConsultantFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const validated = consultantSchema.parse(data);

  await prisma.$transaction([
    prisma.consultantGroup.deleteMany({ where: { consultantId: id } }),
    prisma.consultantBillingRole.deleteMany({ where: { consultantId: id } }),
  ]);

  const consultant = await prisma.consultant.update({
    where: { id },
    data: {
      name: encrypt(validated.name),
      netSuiteName: encryptNullable(validated.netSuiteName || null),
      standardHours: validated.standardHours,
      overtimePreference: validated.overtimePreference,
      overtimeHoursAvailable: validated.overtimeHoursAvailable,
      managerId: validated.managerId || null,
      groups: { create: validated.groups.map((group) => ({ group })) },
      billingRoles: { create: validated.billingRoleIds.map((roleDefinitionId) => ({ roleDefinitionId })) },
    },
    include: {
      groups: true,
      billingRoles: { include: { roleDefinition: { select: { id: true, name: true } } } },
    },
  });

  revalidatePath("/consultants");
  return decryptConsultantFields(consultant);
}

export async function deleteConsultant(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.consultant.delete({ where: { id } });

  revalidatePath("/consultants");
  revalidatePath("/utilization");
}

export async function getAllConsultants() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const consultants = await prisma.consultant.findMany({
    select: {
      id: true,
      name: true,
      standardHours: true,
      billingRoles: { select: { roleDefinitionId: true } },
    },
  });

  return consultants
    .map((c) => ({
      id: c.id,
      name: decrypt(c.name),
      standardHours: c.standardHours,
      billingRoleIds: c.billingRoles.map((br) => br.roleDefinitionId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
