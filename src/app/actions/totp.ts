"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  generateTotpSecret,
  generateTotpUri,
  generateQrCodeDataUrl,
  verifyTotpCode,
  generateSecureToken,
  hashToken,
  DEVICE_TOKEN_TTL_MS,
  MFA_PENDING_TTL_MS,
  MFA_BYPASS_TTL_MS,
} from "@/lib/totp";
import { cookies } from "next/headers";
import { DEVICE_TOKEN_COOKIE, MFA_PENDING_COOKIE } from "@/lib/totp";

// ── Enrollment ─────────────────────────────────────────────────────────────────

/**
 * Begin TOTP enrollment for the currently signed-in user.
 * Returns the QR code data URL and the plain secret (shown once for manual entry).
 * The secret is saved to DB with isVerified=false until the user confirms a code.
 */
export async function beginTotpEnrollment(): Promise<{ qrCode: string; secret: string }> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const secret = generateTotpSecret();
  const uri = generateTotpUri(session.user.email, secret);
  const qrCode = await generateQrCodeDataUrl(uri);

  // Upsert: overwrite any unverified secret (re-enrollment)
  await prisma.userTotpSecret.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, secret, isVerified: false },
    update: { secret, isVerified: false },
  });

  return { qrCode, secret };
}

/**
 * Confirm enrollment by verifying the first code entered by the user.
 */
export async function confirmTotpEnrollment(code: string): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const record = await prisma.userTotpSecret.findUnique({
    where: { userId: session.user.id },
  });

  if (!record) throw new Error("No pending TOTP enrollment found");
  if (record.isVerified) throw new Error("TOTP is already enrolled");

  if (!verifyTotpCode(code, record.secret)) {
    throw new Error("Invalid code. Please try again.");
  }

  await prisma.userTotpSecret.update({
    where: { userId: session.user.id },
    data: { isVerified: true },
  });

  revalidatePath("/profile");
}

/**
 * Admin: reset another user's TOTP enrollment. Forces re-enrollment on next login.
 */
export async function resetUserTotp(userId: string): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.userTotpSecret.deleteMany({ where: { userId } });
  // Also revoke all device tokens so they must re-authenticate fully
  await prisma.deviceToken.deleteMany({ where: { userId } });

  revalidatePath("/users");
}

/**
 * User self-service: remove own TOTP (disables MFA). Requires a valid code.
 */
export async function removeTotpEnrollment(code: string): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const record = await prisma.userTotpSecret.findUnique({
    where: { userId: session.user.id },
  });

  if (!record?.isVerified) throw new Error("No active TOTP enrollment");

  if (!verifyTotpCode(code, record.secret)) {
    throw new Error("Invalid code");
  }

  await prisma.userTotpSecret.delete({ where: { userId: session.user.id } });
  await prisma.deviceToken.deleteMany({ where: { userId: session.user.id } });

  revalidatePath("/profile");
}

// ── MFA Pending token (issued after credential check, before TOTP verify) ─────

/**
 * Called by the login flow after credentials are validated and TOTP is required.
 * Issues a short-lived pending token stored in an httpOnly cookie.
 * Returns the userId so the verify page knows who to verify for.
 */
export async function issueMfaPendingToken(userId: string): Promise<void> {
  const raw = generateSecureToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + MFA_PENDING_TTL_MS);

  await prisma.mfaPendingToken.create({ data: { userId, tokenHash, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(MFA_PENDING_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MFA_PENDING_TTL_MS / 1000,
  });
}

/**
 * Verify a TOTP code using the pending token cookie.
 * On success:
 *   - Consumes the phase-1 pending token
 *   - Optionally issues a 30-day device token cookie
 *   - Issues a phase-2 bypass token (60s TTL) returned to the client
 * Client passes the bypass token to NextAuth signIn({ mfaBypassToken }).
 */
export async function completeMfaVerification(
  code: string,
  rememberDevice: boolean
): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MFA_PENDING_COOKIE)?.value;
  if (!raw) throw new Error("MFA session expired. Please log in again.");

  const tokenHash = hashToken(raw);
  const pending = await prisma.mfaPendingToken.findUnique({
    where: { tokenHash, verified: false },
    include: { user: { include: { totpSecret: true } } },
  });

  if (!pending || pending.expiresAt < new Date()) {
    cookieStore.delete(MFA_PENDING_COOKIE);
    throw new Error("MFA session expired. Please log in again.");
  }

  const secret = pending.user.totpSecret?.secret;
  if (!secret || !pending.user.totpSecret?.isVerified) {
    throw new Error("TOTP not enrolled");
  }

  if (!verifyTotpCode(code, secret)) {
    throw new Error("Invalid code. Please try again.");
  }

  // Consume phase-1 token
  await prisma.mfaPendingToken.delete({ where: { tokenHash } });
  cookieStore.delete(MFA_PENDING_COOKIE);

  // Issue device token if requested
  if (rememberDevice) {
    const deviceRaw = generateSecureToken();
    const deviceHash = hashToken(deviceRaw);
    await prisma.deviceToken.create({
      data: {
        userId: pending.userId,
        tokenHash: deviceHash,
        expiresAt: new Date(Date.now() + DEVICE_TOKEN_TTL_MS),
      },
    });
    cookieStore.set(DEVICE_TOKEN_COOKIE, deviceRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_TOKEN_TTL_MS / 1000,
    });
  }

  // Issue phase-2 bypass token (verified=true, very short TTL)
  const bypassRaw = generateSecureToken();
  const bypassHash = hashToken(bypassRaw);
  await prisma.mfaPendingToken.create({
    data: {
      userId: pending.userId,
      tokenHash: bypassHash,
      verified: true,
      expiresAt: new Date(Date.now() + MFA_BYPASS_TTL_MS),
    },
  });

  return bypassRaw;
}

// ── Forced enrollment during login (user not yet signed in) ───────────────────

/**
 * Begin TOTP enrollment using the MFA pending cookie (pre-auth context).
 * Used by /login/setup-mfa when a user has no TOTP enrolled and must set one up.
 */
export async function beginTotpEnrollmentFromPending(): Promise<{ qrCode: string; secret: string }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MFA_PENDING_COOKIE)?.value;
  if (!raw) throw new Error("Setup session expired. Please log in again.");

  const tokenHash = hashToken(raw);
  const pending = await prisma.mfaPendingToken.findUnique({
    where: { tokenHash, verified: false },
    include: { user: true },
  });

  if (!pending || pending.expiresAt < new Date()) {
    cookieStore.delete(MFA_PENDING_COOKIE);
    throw new Error("Setup session expired. Please log in again.");
  }

  const secret = generateTotpSecret();
  const uri = generateTotpUri(pending.user.email, secret);
  const qrCode = await generateQrCodeDataUrl(uri);

  await prisma.userTotpSecret.upsert({
    where: { userId: pending.userId },
    create: { userId: pending.userId, secret, isVerified: false },
    update: { secret, isVerified: false },
  });

  return { qrCode, secret };
}

/**
 * Confirm TOTP enrollment and complete login — all from the pending cookie context.
 * On success: marks TOTP verified, optionally issues device token, returns bypass token.
 */
export async function completeTotpEnrollmentFromPending(
  code: string,
  rememberDevice: boolean
): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MFA_PENDING_COOKIE)?.value;
  if (!raw) throw new Error("Setup session expired. Please log in again.");

  const tokenHash = hashToken(raw);
  const pending = await prisma.mfaPendingToken.findUnique({
    where: { tokenHash, verified: false },
    include: { user: { include: { totpSecret: true } } },
  });

  if (!pending || pending.expiresAt < new Date()) {
    cookieStore.delete(MFA_PENDING_COOKIE);
    throw new Error("Setup session expired. Please log in again.");
  }

  const record = pending.user.totpSecret;
  if (!record || record.isVerified) throw new Error("No pending TOTP enrollment found.");

  if (!verifyTotpCode(code, record.secret)) {
    throw new Error("Invalid code. Please try again.");
  }

  // Mark TOTP as verified
  await prisma.userTotpSecret.update({
    where: { userId: pending.userId },
    data: { isVerified: true },
  });

  // Consume phase-1 pending token
  await prisma.mfaPendingToken.delete({ where: { tokenHash } });
  cookieStore.delete(MFA_PENDING_COOKIE);

  // Issue device token if requested
  if (rememberDevice) {
    const deviceRaw = generateSecureToken();
    const deviceHash = hashToken(deviceRaw);
    await prisma.deviceToken.create({
      data: {
        userId: pending.userId,
        tokenHash: deviceHash,
        expiresAt: new Date(Date.now() + DEVICE_TOKEN_TTL_MS),
      },
    });
    cookieStore.set(DEVICE_TOKEN_COOKIE, deviceRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_TOKEN_TTL_MS / 1000,
    });
  }

  // Issue bypass token to complete NextAuth signIn
  const bypassRaw = generateSecureToken();
  const bypassHash = hashToken(bypassRaw);
  await prisma.mfaPendingToken.create({
    data: {
      userId: pending.userId,
      tokenHash: bypassHash,
      verified: true,
      expiresAt: new Date(Date.now() + MFA_BYPASS_TTL_MS),
    },
  });

  return bypassRaw;
}

// ── Device token check (used in auth.ts authorize) ────────────────────────────

/**
 * Returns the userId if the device token cookie is valid, null otherwise.
 * Called during credential verification to skip TOTP for trusted devices.
 */
export async function checkDeviceToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.deviceToken.findUnique({ where: { tokenHash } });

  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await prisma.deviceToken.delete({ where: { tokenHash } });
    }
    return null;
  }

  return record.userId;
}

/**
 * Returns the user's TOTP enrollment status for the current session.
 */
export async function getTotpStatus(): Promise<{ enrolled: boolean; verified: boolean }> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const record = await prisma.userTotpSecret.findUnique({
    where: { userId: session.user.id },
    select: { isVerified: true },
  });

  return { enrolled: !!record, verified: record?.isVerified ?? false };
}

/**
 * Admin: get TOTP status for all users (for the users management page).
 */
export async function getAllUserTotpStatus(): Promise<Record<string, boolean>> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const records = await prisma.userTotpSecret.findMany({
    where: { isVerified: true },
    select: { userId: true },
  });

  return Object.fromEntries(records.map((r) => [r.userId, true]));
}
