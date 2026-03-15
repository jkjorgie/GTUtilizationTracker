import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENC_PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY env var must be set to a 64-character hex string. Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt a plaintext string. Returns an `enc:<base64url>` token. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, ct]);
  return ENC_PREFIX + combined.toString("base64url");
}

/**
 * Decrypt an `enc:<base64url>` token back to plaintext.
 * If the value does not start with `enc:` it is returned as-is (plaintext
 * passthrough for records that pre-date the migration).
 */
export function decrypt(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value;
  const key = getKey();
  const combined = Buffer.from(value.slice(ENC_PREFIX.length), "base64url");
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ct = combined.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString("utf8") + decipher.final("utf8");
}

/** encrypt, but returns null for null/undefined/empty inputs. */
export function encryptNullable(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  return encrypt(value);
}

/** decrypt, but returns null for null/undefined/empty inputs. */
export function decryptNullable(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  return decrypt(value);
}

// ── JSON field helpers ──────────────────────────────────────────────────────

export type EncryptableRisk = {
  id: string;
  description: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  mitigation: string;
  owner: string;
};

export type EncryptableActionItem = {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: "OPEN" | "DONE" | "BLOCKED";
};

/** Encrypts description, mitigation, owner on each risk item. id and impact stay plaintext. */
export function encryptRisks(risks: EncryptableRisk[]): EncryptableRisk[] {
  return risks.map((r) => ({
    ...r,
    description: encrypt(r.description),
    mitigation: encrypt(r.mitigation),
    owner: encrypt(r.owner),
  }));
}

/** Decrypts description, mitigation, owner on each risk item. */
export function decryptRisks(value: unknown): EncryptableRisk[] {
  if (!Array.isArray(value)) return [];
  return (value as EncryptableRisk[]).map((r) => ({
    ...r,
    description: decrypt(r.description),
    mitigation: decrypt(r.mitigation),
    owner: decrypt(r.owner),
  }));
}

/** Encrypts description and owner on each action item. id, dueDate, status stay plaintext. */
export function encryptActionItems(items: EncryptableActionItem[]): EncryptableActionItem[] {
  return items.map((i) => ({
    ...i,
    description: encrypt(i.description),
    owner: encrypt(i.owner),
  }));
}

/** Decrypts description and owner on each action item. */
export function decryptActionItems(value: unknown): EncryptableActionItem[] {
  if (!Array.isArray(value)) return [];
  return (value as EncryptableActionItem[]).map((i) => ({
    ...i,
    description: decrypt(i.description),
    owner: decrypt(i.owner),
  }));
}
