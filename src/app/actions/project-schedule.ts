"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ScheduleItemType } from "@prisma/client";
import { encrypt, encryptNullable, decrypt, decryptNullable } from "@/lib/encryption";

export type ScheduleItemData = {
  id: string;
  projectId: string;
  type: ScheduleItemType;
  name: string;
  owner: string | null;
  startDate: Date | null;
  endDate: Date | null;
  percentComplete: number;
  displayOrder: number;
  parentId: string | null;
  children: ScheduleItemData[];
};

function buildTree(items: Omit<ScheduleItemData, "children">[]): ScheduleItemData[] {
  const map = new Map<string, ScheduleItemData>();
  items.forEach((i) => map.set(i.id, { ...i, children: [] }));

  const roots: ScheduleItemData[] = [];
  map.forEach((item) => {
    if (item.parentId) {
      const parent = map.get(item.parentId);
      if (parent) parent.children.push(item);
    } else {
      roots.push(item);
    }
  });

  const sortItems = (arr: ScheduleItemData[]) => {
    arr.sort((a, b) => a.displayOrder - b.displayOrder);
    arr.forEach((i) => sortItems(i.children));
  };
  sortItems(roots);

  return roots;
}

export async function getProjectSchedule(projectId: string): Promise<ScheduleItemData[]> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const items = await prisma.projectScheduleItem.findMany({
    where: { projectId },
    orderBy: { displayOrder: "asc" },
  });

  const decrypted = items.map((i) => ({
    ...i,
    name: decrypt(i.name),
    owner: decryptNullable(i.owner),
  }));

  return buildTree(decrypted);
}

export async function createScheduleItem(
  projectId: string,
  data: {
    type: ScheduleItemType;
    name: string;
    owner?: string;
    startDate?: string;
    endDate?: string;
    percentComplete?: number;
    parentId?: string;
  }
): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const maxOrder = await prisma.projectScheduleItem.findFirst({
    where: { projectId, parentId: data.parentId ?? null },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  await prisma.projectScheduleItem.create({
    data: {
      projectId,
      type: data.type,
      name: encrypt(data.name),
      owner: encryptNullable(data.owner ?? null),
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      percentComplete: data.percentComplete ?? 0,
      displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
      parentId: data.parentId ?? null,
    },
  });

  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/report`);
}

export async function updateScheduleItem(
  itemId: string,
  data: {
    name?: string;
    owner?: string;
    startDate?: string | null;
    endDate?: string | null;
    percentComplete?: number;
  }
): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const item = await prisma.projectScheduleItem.update({
    where: { id: itemId },
    data: {
      ...(data.name !== undefined && { name: encrypt(data.name) }),
      ...(data.owner !== undefined && { owner: encryptNullable(data.owner) }),
      ...(data.startDate !== undefined && {
        startDate: data.startDate ? new Date(data.startDate) : null,
      }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.percentComplete !== undefined && { percentComplete: data.percentComplete }),
    },
  });

  revalidatePath(`/projects/${item.projectId}/schedule`);
  revalidatePath(`/projects/${item.projectId}/report`);
}

export async function deleteScheduleItem(itemId: string): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const item = await prisma.projectScheduleItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  await prisma.projectScheduleItem.delete({ where: { id: itemId } });

  revalidatePath(`/projects/${item.projectId}/schedule`);
  revalidatePath(`/projects/${item.projectId}/report`);
}

export async function reorderScheduleItems(
  projectId: string,
  orderedIds: string[]
): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.projectScheduleItem.update({
        where: { id },
        data: { displayOrder: index },
      })
    )
  );

  revalidatePath(`/projects/${projectId}/schedule`);
}
