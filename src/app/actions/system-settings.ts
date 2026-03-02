"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getSystemSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function upsertSystemSetting(key: string, value: string): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  revalidatePath("/settings");
  revalidatePath("/invoicing");
}

export async function getAllSystemSettings(): Promise<Record<string, string>> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const settings = await prisma.systemSetting.findMany();
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}
