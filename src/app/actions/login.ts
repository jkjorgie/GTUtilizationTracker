"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkDeviceToken, issueMfaPendingToken } from "./totp";
import { cookies } from "next/headers";
import { DEVICE_TOKEN_COOKIE, generateSecureToken, hashToken, MFA_BYPASS_TTL_MS } from "@/lib/totp";

const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

async function checkRateLimit(email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const count = await prisma.loginAttempt.count({
    where: { email, createdAt: { gte: windowStart } },
  });
  return count < RATE_LIMIT_MAX_ATTEMPTS;
}

async function recordFailedAttempt(email: string) {
  await prisma.loginAttempt.create({ data: { email } });
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  await prisma.loginAttempt.deleteMany({ where: { email, createdAt: { lt: windowStart } } });
}

async function clearFailedAttempts(email: string) {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}

async function issueBypassToken(userId: string): Promise<string> {
  const raw = generateSecureToken();
  const tokenHash = hashToken(raw);
  await prisma.mfaPendingToken.create({
    data: {
      userId,
      tokenHash,
      verified: true,
      expiresAt: new Date(Date.now() + MFA_BYPASS_TTL_MS),
    },
  });
  return raw;
}

export type LoginStep1Result =
  | { status: "mfa_required" }
  | { status: "mfa_setup_required" }
  | { status: "ok"; bypassToken: string }
  | { status: "rate_limited" }
  | { status: "invalid" };

/**
 * Step 1: validate email + password.
 * - If rate limited → return "rate_limited"
 * - If credentials invalid → return "invalid"
 * - If TOTP enrolled + no valid device token → issue MFA pending token, return "mfa_required"
 * - Otherwise → issue a short-lived bypass token, return "ok"
 *
 * Sign-in always completes via signIn({ mfaBypassToken }), never via raw
 * email+password, preventing TOTP bypass through direct NextAuth credential submission.
 */
export async function loginStep1(email: string, password: string): Promise<LoginStep1Result> {
  const normalizedEmail = email.toLowerCase().trim();

  const allowed = await checkRateLimit(normalizedEmail);
  if (!allowed) return { status: "rate_limited" };

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { consultant: true, totpSecret: true },
  });

  if (!user) {
    await recordFailedAttempt(normalizedEmail);
    return { status: "invalid" };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await recordFailedAttempt(normalizedEmail);
    return { status: "invalid" };
  }

  await clearFailedAttempts(normalizedEmail);

  // Trusted device cookie → skip TOTP
  const cookieStore = await cookies();
  const deviceRaw = cookieStore.get(DEVICE_TOKEN_COOKIE)?.value;
  if (deviceRaw) {
    const deviceUserId = await checkDeviceToken(deviceRaw);
    if (deviceUserId === user.id) {
      return { status: "ok", bypassToken: await issueBypassToken(user.id) };
    }
  }

  // TOTP enrolled and verified → require MFA step
  if (user.totpSecret?.isVerified) {
    await issueMfaPendingToken(user.id);
    return { status: "mfa_required" };
  }

  // No verified TOTP → require enrollment before access is granted
  await issueMfaPendingToken(user.id);
  return { status: "mfa_setup_required" };
}
