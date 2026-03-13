"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { passwordSchema } from "@/lib/password-validation";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type ChangePasswordData = z.infer<typeof changePasswordSchema>;

const forcedResetSchema = z.object({
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type ForcedResetData = z.infer<typeof forcedResetSchema>;

export async function completeForcedPasswordReset(data: ForcedResetData) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const validated = forcedResetSchema.parse(data);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("User not found");

  const isSamePassword = await bcrypt.compare(validated.newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new Error("New password must be different from your current password");
  }

  const newPasswordHash = await bcrypt.hash(validated.newPassword, 10);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: newPasswordHash,
      requirePasswordReset: false,
    },
  });

  return { success: true };
}

export async function getProfile() {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      consultant: {
        include: {
          groups: true,
          roles: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function changePassword(data: ChangePasswordData) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const validated = changePasswordSchema.parse(data);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(validated.currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new Error("Current password is incorrect");
  }

  // Prevent reuse
  const isSamePassword = await bcrypt.compare(validated.newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new Error("New password must be different from your current password");
  }

  const newPasswordHash = await bcrypt.hash(validated.newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newPasswordHash },
  });

  return { success: true };
}
