"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ProjectType, ProjectStatus, SalesManager, Currency, ContractType, HealthStatus, GroupType, AllocationEntryType } from "@prisma/client";

const projectSchema = z.object({
  client: z.string().min(1, "Client is required"),
  projectName: z.string().min(1, "Project name is required"),
  timecode: z.string().min(1, "Timecode is required"),
  type: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
  projectManagerId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  salesManager: z.nativeEnum(SalesManager).optional().nullable(),
  budget: z.number().min(0).optional().nullable(),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  contractType: z.nativeEnum(ContractType).optional().nullable(),
  healthStatus: z.nativeEnum(HealthStatus).optional().nullable(),
  salesDiscount: z.number().min(0).max(100).optional().nullable(),
  comments: z.string().optional().nullable(),
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
    include: {
      projectManager: { select: { id: true, name: true } },
    },
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
    include: {
      projectManager: { select: { id: true, name: true } },
      members: {
        include: {
          consultant: { select: { id: true, name: true } },
          roleDefinition: { select: { id: true, name: true, msrpRate: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createProject(data: ProjectFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = projectSchema.parse(data);

  const project = await prisma.project.create({
    data: {
      client: validated.client,
      projectName: validated.projectName,
      timecode: validated.timecode,
      type: validated.type,
      status: validated.status,
      projectManagerId: validated.projectManagerId || null,
      startDate: validated.startDate ? new Date(validated.startDate) : null,
      endDate: validated.endDate ? new Date(validated.endDate) : null,
      salesManager: validated.salesManager || null,
      budget: validated.budget ?? null,
      currency: validated.currency,
      contractType: validated.contractType || null,
      healthStatus: validated.healthStatus || null,
      salesDiscount: validated.salesDiscount ?? null,
      comments: validated.comments || null,
    },
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

  const project = await prisma.project.update({
    where: { id },
    data: {
      client: validated.client,
      projectName: validated.projectName,
      timecode: validated.timecode,
      type: validated.type,
      status: validated.status,
      projectManagerId: validated.projectManagerId || null,
      startDate: validated.startDate ? new Date(validated.startDate) : null,
      endDate: validated.endDate ? new Date(validated.endDate) : null,
      salesManager: validated.salesManager || null,
      budget: validated.budget ?? null,
      currency: validated.currency,
      contractType: validated.contractType || null,
      healthStatus: validated.healthStatus || null,
      salesDiscount: validated.salesDiscount ?? null,
      comments: validated.comments || null,
    },
  });

  revalidatePath("/projects");
  return project;
}

export async function deleteProject(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Only block on actual (logged) hours — projected allocations are fine to delete
  const actualAllocations = await prisma.allocation.count({
    where: { projectId: id, entryType: AllocationEntryType.ACTUAL },
  });

  if (actualAllocations > 0) {
    throw new Error(
      "Cannot delete project with logged actual hours. Set status to inactive instead."
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

export async function getPEMConsultants() {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return prisma.consultant.findMany({
    where: {
      groups: { some: { group: GroupType.PEM } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
