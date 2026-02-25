"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateRoleSchema = z.object({
  msrpRate: z.number().min(0),
  isActive: z.boolean(),
});

export type RoleDefinitionData = z.infer<typeof updateRoleSchema>;

export async function getRoleDefinitions() {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return prisma.roleDefinition.findMany({
    orderBy: { msrpRate: "desc" },
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
