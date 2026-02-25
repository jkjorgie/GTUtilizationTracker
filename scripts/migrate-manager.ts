/**
 * One-time migration: convert hrManager (string name) to managerId (FK to Consultant).
 * Run with: npx tsx scripts/migrate-manager.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const consultants: Array<{ id: string; name: string; hrManager: string | null }> =
    await prisma.$queryRaw`SELECT id, name, "hrManager" FROM "Consultant" WHERE "hrManager" IS NOT NULL AND "hrManager" != ''`;

  if (consultants.length === 0) {
    console.log("No consultants with hrManager to migrate.");
    return;
  }

  console.log(`Found ${consultants.length} consultant(s) with hrManager set.`);

  const allConsultants = await prisma.consultant.findMany({
    select: { id: true, name: true },
  });

  const users = await prisma.user.findMany({
    select: { id: true, email: true, consultant: { select: { id: true, name: true } } },
  });

  const nameToConsultantId = new Map<string, string>();
  for (const c of allConsultants) {
    nameToConsultantId.set(c.name.toLowerCase().trim(), c.id);
  }
  for (const u of users) {
    if (u.consultant) {
      nameToConsultantId.set(u.email.toLowerCase().trim(), u.consultant.id);
    }
  }

  let migrated = 0;
  let skipped = 0;
  for (const c of consultants) {
    const managerName = c.hrManager?.trim();
    if (!managerName) continue;

    const managerId = nameToConsultantId.get(managerName.toLowerCase());
    if (managerId) {
      await prisma.$executeRaw`UPDATE "Consultant" SET "managerId" = ${managerId} WHERE id = ${c.id}`;
      console.log(`  ${c.name} -> managerId ${managerId} (matched "${managerName}")`);
      migrated++;
    } else {
      console.log(`  ${c.name} -> SKIPPED, no match for "${managerName}"`);
      skipped++;
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
