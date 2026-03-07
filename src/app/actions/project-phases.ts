"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ProjectPhaseData = {
  id: string;
  projectId: string;
  name: string;
  color: string;
  percentComplete: number;
  budgetSpent: number;
  totalBudget: number;
  displayOrder: number;
};

export async function getProjectPhases(projectId: string): Promise<ProjectPhaseData[]> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  return prisma.projectPhase.findMany({
    where: { projectId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      projectId: true,
      name: true,
      color: true,
      percentComplete: true,
      budgetSpent: true,
      totalBudget: true,
      displayOrder: true,
    },
  });
}

export async function createProjectPhase(
  projectId: string,
  data: { name: string; color: string; percentComplete: number; budgetSpent: number; totalBudget: number }
): Promise<ProjectPhaseData> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const last = await prisma.projectPhase.findFirst({
    where: { projectId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  const phase = await prisma.projectPhase.create({
    data: {
      projectId,
      name: data.name,
      color: data.color,
      percentComplete: data.percentComplete,
      budgetSpent: data.budgetSpent,
      totalBudget: data.totalBudget,
      displayOrder: (last?.displayOrder ?? -1) + 1,
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      color: true,
      percentComplete: true,
      budgetSpent: true,
      totalBudget: true,
      displayOrder: true,
    },
  });

  revalidatePath(`/projects/${projectId}/report`);
  return phase;
}

export async function updateProjectPhase(
  phaseId: string,
  data: { name?: string; color?: string; percentComplete?: number; budgetSpent?: number; totalBudget?: number }
): Promise<ProjectPhaseData> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const phase = await prisma.projectPhase.update({
    where: { id: phaseId },
    data,
    select: {
      id: true,
      projectId: true,
      name: true,
      color: true,
      percentComplete: true,
      budgetSpent: true,
      totalBudget: true,
      displayOrder: true,
    },
  });

  revalidatePath(`/projects/${phase.projectId}/report`);
  return phase;
}

export async function deleteProjectPhase(phaseId: string): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    select: { projectId: true },
  });
  if (!phase) throw new Error("Phase not found");

  await prisma.projectPhase.delete({ where: { id: phaseId } });
  revalidatePath(`/projects/${phase.projectId}/report`);
}
