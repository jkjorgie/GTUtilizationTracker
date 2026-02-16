"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ProjectType, ProjectStatus } from "@prisma/client";

const projectSchema = z.object({
  client: z.string().min(1, "Client is required"),
  projectName: z.string().min(1, "Project name is required"),
  timecode: z.string().min(1, "Timecode is required"),
  type: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export async function getProjects(filters?: {
  status?: ProjectStatus;
  type?: ProjectType;
  search?: string;
}) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const where: {
    status?: ProjectStatus;
    type?: ProjectType;
    OR?: Array<{ client: { contains: string; mode: "insensitive" } } | { projectName: { contains: string; mode: "insensitive" } } | { timecode: { contains: string; mode: "insensitive" } }>;
  } = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.search) {
    where.OR = [
      { client: { contains: filters.search, mode: "insensitive" } },
      { projectName: { contains: filters.search, mode: "insensitive" } },
      { timecode: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(id: string) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return prisma.project.findUnique({
    where: { id },
  });
}

export async function createProject(data: ProjectFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = projectSchema.parse(data);

  // Check for duplicate timecode
  const existing = await prisma.project.findUnique({
    where: { timecode: validated.timecode },
  });

  if (existing) {
    throw new Error("A project with this timecode already exists");
  }

  const project = await prisma.project.create({
    data: validated,
  });

  revalidatePath("/projects");
  return project;
}

export async function updateProject(id: string, data: ProjectFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = projectSchema.parse(data);

  // Check for duplicate timecode (excluding current project)
  const existing = await prisma.project.findFirst({
    where: {
      timecode: validated.timecode,
      NOT: { id },
    },
  });

  if (existing) {
    throw new Error("A project with this timecode already exists");
  }

  const project = await prisma.project.update({
    where: { id },
    data: validated,
  });

  revalidatePath("/projects");
  return project;
}

export async function deleteProject(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Check if project has any allocations
  const allocations = await prisma.allocation.count({
    where: { projectId: id },
  });

  if (allocations > 0) {
    throw new Error(
      "Cannot delete project with existing allocations. Set status to inactive instead."
    );
  }

  await prisma.project.delete({
    where: { id },
  });

  revalidatePath("/projects");
}

export async function getActiveProjects() {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return prisma.project.findMany({
    where: { status: ProjectStatus.ACTIVE },
    orderBy: { projectName: "asc" },
    select: {
      id: true,
      client: true,
      projectName: true,
      timecode: true,
      type: true,
    },
  });
}
