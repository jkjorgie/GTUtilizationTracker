/**
 * One-time migration script: encrypts all existing plaintext values in the DB.
 *
 * Safe to run multiple times — values already starting with "enc:" are skipped.
 *
 * Usage:
 *   ENCRYPTION_KEY=<64-hex-chars> npx tsx prisma/encrypt-existing-data.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createCipheriv, randomBytes } from "crypto";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  console.log("DATABASE_URL host:", new URL(connectionString).hostname);
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENC_PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string. Run: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, ct]);
  return ENC_PREFIX + combined.toString("base64url");
}

function encryptIfNeeded(value: string): string {
  return value.startsWith(ENC_PREFIX) ? value : encrypt(value);
}

function encryptNullableIfNeeded(value: string | null): string | null {
  if (!value) return value;
  return encryptIfNeeded(value);
}

async function main() {
  console.log("Starting encryption migration...\n");
  let total = 0;

  // ── Consultant: name, netSuiteName ─────────────────────────────────────────
  {
    const rows = await prisma.consultant.findMany({ select: { id: true, name: true, netSuiteName: true } });
    let count = 0;
    for (const row of rows) {
      const newName = encryptIfNeeded(row.name);
      const newNetSuiteName = encryptNullableIfNeeded(row.netSuiteName);
      if (newName !== row.name || newNetSuiteName !== row.netSuiteName) {
        await prisma.consultant.update({
          where: { id: row.id },
          data: { name: newName, netSuiteName: newNetSuiteName },
        });
        count++;
      }
    }
    console.log(`Consultant: ${count}/${rows.length} rows encrypted`);
    total += count;
  }

  // ── Project: client, projectName, timecode, comments ──────────────────────
  {
    const rows = await prisma.project.findMany({
      select: { id: true, client: true, projectName: true, timecode: true, comments: true },
    });
    let count = 0;
    for (const row of rows) {
      const newClient = encryptIfNeeded(row.client);
      const newProjectName = encryptIfNeeded(row.projectName);
      const newTimecode = encryptNullableIfNeeded(row.timecode);
      const newComments = encryptNullableIfNeeded(row.comments);
      if (
        newClient !== row.client ||
        newProjectName !== row.projectName ||
        newTimecode !== row.timecode ||
        newComments !== row.comments
      ) {
        await prisma.project.update({
          where: { id: row.id },
          data: { client: newClient, projectName: newProjectName, timecode: newTimecode, comments: newComments },
        });
        count++;
      }
    }
    console.log(`Project: ${count}/${rows.length} rows encrypted`);
    total += count;
  }

  // ── ProjectScheduleItem: name, owner ──────────────────────────────────────
  {
    const rows = await prisma.projectScheduleItem.findMany({ select: { id: true, name: true, owner: true } });
    let count = 0;
    for (const row of rows) {
      const newName = encryptIfNeeded(row.name);
      const newOwner = encryptNullableIfNeeded(row.owner);
      if (newName !== row.name || newOwner !== row.owner) {
        await prisma.projectScheduleItem.update({
          where: { id: row.id },
          data: { name: newName, owner: newOwner },
        });
        count++;
      }
    }
    console.log(`ProjectScheduleItem: ${count}/${rows.length} rows encrypted`);
    total += count;
  }

  // ── OtherInvoice: description ──────────────────────────────────────────────
  {
    const rows = await prisma.otherInvoice.findMany({ select: { id: true, description: true } });
    let count = 0;
    for (const row of rows) {
      const newDescription = encryptNullableIfNeeded(row.description);
      if (newDescription !== row.description) {
        await prisma.otherInvoice.update({ where: { id: row.id }, data: { description: newDescription } });
        count++;
      }
    }
    console.log(`OtherInvoice: ${count}/${rows.length} rows encrypted`);
    total += count;
  }

  // ── ProjectReport: highlights, upcomingWork, risks (attrs), actionItems (attrs) ──
  {
    const rows = await prisma.projectReport.findMany({
      select: { id: true, highlights: true, upcomingWork: true, risks: true, actionItems: true },
    });
    let count = 0;
    for (const row of rows) {
      const newHighlights = encryptNullableIfNeeded(row.highlights);
      const newUpcomingWork = encryptNullableIfNeeded(row.upcomingWork);

      // Risks: encrypt description, mitigation, owner if not already encrypted
      let newRisks = row.risks;
      if (Array.isArray(row.risks)) {
        newRisks = (row.risks as Array<{ description: string; mitigation: string; owner: string; [key: string]: unknown }>).map(
          (r) => ({
            ...r,
            description: encryptIfNeeded(r.description),
            mitigation: encryptIfNeeded(r.mitigation),
            owner: encryptIfNeeded(r.owner),
          })
        );
      }

      // ActionItems: encrypt description, owner if not already encrypted
      let newActionItems = row.actionItems;
      if (Array.isArray(row.actionItems)) {
        newActionItems = (row.actionItems as Array<{ description: string; owner: string; [key: string]: unknown }>).map(
          (ai) => ({
            ...ai,
            description: encryptIfNeeded(ai.description),
            owner: encryptIfNeeded(ai.owner),
          })
        );
      }

      if (
        newHighlights !== row.highlights ||
        newUpcomingWork !== row.upcomingWork ||
        JSON.stringify(newRisks) !== JSON.stringify(row.risks) ||
        JSON.stringify(newActionItems) !== JSON.stringify(row.actionItems)
      ) {
        await prisma.projectReport.update({
          where: { id: row.id },
          data: {
            highlights: newHighlights,
            upcomingWork: newUpcomingWork,
            risks: newRisks as object[],
            actionItems: newActionItems as object[],
          },
        });
        count++;
      }
    }
    console.log(`ProjectReport: ${count}/${rows.length} rows encrypted`);
    total += count;
  }

  console.log(`\nDone. ${total} total rows updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
