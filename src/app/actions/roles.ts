"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RoleLevel } from "@prisma/client";

const ALL_ROLE_LEVELS = Object.values(RoleLevel);

const updateRoleSchema = z.object({
  msrpRate: z.number().min(0),
  isActive: z.boolean(),
});

export type RoleDefinitionData = z.infer<typeof updateRoleSchema>;

export async function ensureRoleDefinitions() {
  const existing = await prisma.roleDefinition.findMany({
    select: { level: true },
  });
  const existingLevels = new Set(existing.map(r => r.level));

  const missing = ALL_ROLE_LEVELS.filter(level => !existingLevels.has(level));
  if (missing.length > 0) {
    await prisma.roleDefinition.createMany({
      data: missing.map(level => ({ level })),
    });
  }
}

export async function getRoleDefinitions() {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  await ensureRoleDefinitions();

  return prisma.roleDefinition.findMany({
    orderBy: { level: "asc" },
  });
}

export async function updateRoleDefinition(id: string, data: RoleDefinitionData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = updateRoleSchema.parse(data);

  const updated = await prisma.roleDefinition.update({
    where: { id },
    data: {
      msrpRate: validated.msrpRate,
      isActive: validated.isActive,
    },
  });

  revalidatePath("/roles");
  return updated;
}
