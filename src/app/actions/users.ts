"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  role: z.nativeEnum(UserRole),
  consultantId: z.string().nullable().optional(),
});

export type UserFormData = z.infer<typeof userSchema>;

export async function getUsers() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      consultant: {
        select: {
          id: true,
          name: true,
        },
      },
      createdAt: true,
    },
    orderBy: { email: "asc" },
  });
}

export async function getUser(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      consultantId: true,
    },
  });
}

export async function createUser(data: UserFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = userSchema.parse(data);

  if (!validated.password) {
    throw new Error("Password is required for new users");
  }

  // Check for existing user
  const existing = await prisma.user.findUnique({
    where: { email: validated.email },
  });

  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(validated.password, 10);

  const user = await prisma.user.create({
    data: {
      email: validated.email,
      passwordHash,
      role: validated.role,
      consultantId: validated.consultantId || null,
    },
  });

  revalidatePath("/users");
  return user;
}

export async function updateUser(id: string, data: UserFormData) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const validated = userSchema.parse(data);

  // Check for duplicate email (excluding current user)
  const existing = await prisma.user.findFirst({
    where: {
      email: validated.email,
      NOT: { id },
    },
  });

  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const updateData: {
    email: string;
    role: UserRole;
    consultantId: string | null;
    passwordHash?: string;
  } = {
    email: validated.email,
    role: validated.role,
    consultantId: validated.consultantId || null,
  };

  // Only update password if provided
  if (validated.password) {
    updateData.passwordHash = await bcrypt.hash(validated.password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/users");
  return user;
}

export async function deleteUser(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Prevent deleting yourself
  if (session.user.id === id) {
    throw new Error("You cannot delete your own account");
  }

  await prisma.user.delete({
    where: { id },
  });

  revalidatePath("/users");
}

export async function resetUserPassword(id: string, newPassword: string) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function getUnlinkedConsultants() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Get consultants that don't have a user account linked
  return prisma.consultant.findMany({
    where: {
      user: null,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getAllConsultantsForLinking() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  return prisma.consultant.findMany({
    select: {
      id: true,
      name: true,
      user: {
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });
}
