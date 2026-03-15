"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ProjectType, ProjectStatus, SalesManager, Currency, ContractType, HealthStatus, GroupType, AllocationEntryType } from "@prisma/client";
import { encrypt, encryptNullable, decrypt, decryptNullable } from "@/lib/encryption";

const projectSchema = z.object({
  client: z.string().min(1, "Client is required"),
  projectName: z.string().min(1, "Project name is required"),
  timecode: z.string().optional().nullable(),
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

function decryptProjectFields<T extends { client: string; projectName: string; timecode?: string | null; comments?: string | null }>(p: T): T {
  return {
    ...p,
    client: decrypt(p.client),
    projectName: decrypt(p.projectName),
    timecode: decryptNullable(p.timecode),
    comments: decryptNullable(p.comments),
  };
}

export async function getProjects(filters?: {
  status?: ProjectStatus;
  type?: ProjectType;
  search?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const where: { status?: ProjectStatus; type?: ProjectType } = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  // Search is done in-memory after decryption — SQL LIKE does not work on encrypted values
  const results = await prisma.project.findMany({
    where,
    include: {
      projectManager: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const decrypted = results.map((p) => ({
    ...p,
    client: decrypt(p.client),
    projectName: decrypt(p.projectName),
    timecode: decryptNullable(p.timecode),
    comments: decryptNullable(p.comments),
    projectManager: p.projectManager
      ? { ...p.projectManager, name: decrypt(p.projectManager.name) }
      : null,
  }));

  if (!filters?.search) return decrypted;

  const q = filters.search.toLowerCase();
  return decrypted.filter(
    (p) =>
      p.client.toLowerCase().includes(q) ||
      p.projectName.toLowerCase().includes(q) ||
      (p.timecode?.toLowerCase().includes(q) ?? false)
  );
}

export async function getProject(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const p = await prisma.project.findUnique({
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

  if (!p) return null;
  return {
    ...p,
    client: decrypt(p.client),
    projectName: decrypt(p.projectName),
    timecode: decryptNullable(p.timecode),
    comments: decryptNullable(p.comments),
    projectManager: p.projectManager
      ? { ...p.projectManager, name: decrypt(p.projectManager.name) }
      : null,
    members: p.members.map((m) => ({
      ...m,
      consultant: { ...m.consultant, name: decrypt(m.consultant.name) },
    })),
  };
}

export async function createProject(data: ProjectFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const validated = projectSchema.parse(data);

  const project = await prisma.project.create({
    data: {
      client: encrypt(validated.client),
      projectName: encrypt(validated.projectName),
      timecode: encryptNullable(validated.timecode ?? null),
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
      comments: encryptNullable(validated.comments || null),
    },
  });

  revalidatePath("/projects");
  return decryptProjectFields(project);
}

export async function updateProject(id: string, data: ProjectFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const validated = projectSchema.parse(data);

  const project = await prisma.project.update({
    where: { id },
    data: {
      client: encrypt(validated.client),
      projectName: encrypt(validated.projectName),
      timecode: encryptNullable(validated.timecode ?? null),
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
      comments: encryptNullable(validated.comments || null),
    },
  });

  revalidatePath("/projects");
  return decryptProjectFields(project);
}

export async function deleteProject(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const actualAllocations = await prisma.allocation.count({
    where: { projectId: id, entryType: AllocationEntryType.ACTUAL },
  });

  if (actualAllocations > 0) {
    throw new Error(
      "Cannot delete project with logged actual hours. Set status to inactive instead."
    );
  }

  await prisma.project.delete({ where: { id } });

  revalidatePath("/projects");
}

export async function getActiveProjects() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const projects = await prisma.project.findMany({
    where: { status: ProjectStatus.ACTIVE },
    select: {
      id: true,
      client: true,
      projectName: true,
      timecode: true,
      type: true,
      status: true,
      startDate: true,
      endDate: true,
      projectManager: { select: { name: true } },
    },
  });

  return projects
    .map((p) => ({
      ...p,
      client: decrypt(p.client),
      projectName: decrypt(p.projectName),
      timecode: decryptNullable(p.timecode),
      projectManager: p.projectManager
        ? { name: decrypt(p.projectManager.name) }
        : null,
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName));
}

export async function getPEMConsultants() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const consultants = await prisma.consultant.findMany({
    where: { groups: { some: { group: GroupType.PEM } } },
    select: { id: true, name: true },
  });

  return consultants
    .map((c) => ({ id: c.id, name: decrypt(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
