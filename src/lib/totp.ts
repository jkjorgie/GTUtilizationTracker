import {
  generateSecret as otplibGenerateSecret,
  generateURI,
  verifySync,
} from "otplib";
import { randomBytes, createHash } from "crypto";
import QRCode from "qrcode";

const APP_NAME = "GT Utilization Tracker";

// TOTP secret is stored in DB — Phase 6 will add AES-256-GCM encryption transparently.

export function generateTotpSecret(): string {
  return otplibGenerateSecret({ length: 20 }); // 160-bit secret (recommended)
}

export function generateTotpUri(email: string, secret: string): string {
  return generateURI({
    issuer: APP_NAME,
    label: `${APP_NAME}:${email}`,
    secret,
  });
}

export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { width: 200, margin: 2 });
}

export function verifyTotpCode(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

// ── Token utilities ────────────────────────────────────────────────────────────

/** Generate a cryptographically random URL-safe token (used for MFA pending + device tokens). */
export function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/** One-way SHA-256 hash of a raw token — stored in the DB, never the raw value. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const DEVICE_TOKEN_COOKIE = "gt_device_token";
export const MFA_PENDING_COOKIE = "gt_mfa_pending";
export const DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MFA_PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MFA_BYPASS_TTL_MS = 60 * 1000; // 60 seconds — just long enough to complete signIn
