/**
 * Run with: npx tsx prisma/populate-roles.ts
 * Clears and repopulates the RoleDefinition table with GT 2025 standard rates.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const roles: { name: string; msrpRate: number }[] = [
  { name: "Strategy Consultant", msrpRate: 340 },
  { name: "Sr. Project Manager", msrpRate: 260 },
  { name: "Project Manager", msrpRate: 225 },
  { name: "Engagement Manager", msrpRate: 225 },
  { name: "Sr. Project Administrator", msrpRate: 195 },
  { name: "Project Administrator III", msrpRate: 167 },
  { name: "Project Administrator II", msrpRate: 135 },
  { name: "Project Administrator I", msrpRate: 100 },
  { name: "Change Management/QA/Testing Lead", msrpRate: 255 },
  { name: "Testing Manager", msrpRate: 230 },
  { name: "Sr. QA Specialist/Sr. Change Management Specialist", msrpRate: 200 },
  { name: "QA Specialist III/Change Management Specialist III", msrpRate: 170 },
  { name: "QA Specialist II/Change Management Specialist II", msrpRate: 140 },
  { name: "QA Specialist I/Change Management Specialist I", msrpRate: 105 },
  { name: "Sr. Training Specialist/Training Lead", msrpRate: 230 },
  { name: "Training Specialist", msrpRate: 200 },
  { name: "Solution Architect", msrpRate: 250 },
  { name: "Sr. Process & Content Architect", msrpRate: 250 },
  { name: "Content Architect", msrpRate: 225 },
  { name: "Lead BA/Lead Application Specialist", msrpRate: 250 },
  { name: "Functional Lead/Principal BA", msrpRate: 225 },
  { name: "Sr. BA/Application Specialist", msrpRate: 195 },
  { name: "Sr. Business Process Specialist", msrpRate: 235 },
  { name: "Business Process Specialist", msrpRate: 220 },
  { name: "Functional Analyst III/RPA BA III/Application Specialist III", msrpRate: 167 },
  { name: "Functional Analyst II/RPA BA II/Application Specialist II", msrpRate: 135 },
  { name: "Functional Analyst I/RPA BA I/Application Specialist I", msrpRate: 100 },
  { name: "Sr. Visual Designer", msrpRate: 195 },
  { name: "Visual Designer III", msrpRate: 167 },
  { name: "Visual Designer II", msrpRate: 135 },
  { name: "Visual Designer I", msrpRate: 100 },
  { name: "Lead Computational Linguist", msrpRate: 250 },
  { name: "Sr. Computational Linguist", msrpRate: 195 },
  { name: "Computational Linguist III", msrpRate: 167 },
  { name: "Computational Linguist II", msrpRate: 135 },
  { name: "Computational Linguist I", msrpRate: 100 },
  { name: "Sr. BA/Application Specialist - Nearshore", msrpRate: 150 },
  { name: "FA/Application Specialist III - Nearshore", msrpRate: 130 },
  { name: "FA/Application Specialist II - Nearshore", msrpRate: 115 },
  { name: "FA/Application Specialist I - Nearshore", msrpRate: 100 },
  { name: "Jr. BA/Application Specialist - Nearshore", msrpRate: 50 },
  { name: "Business Process Specialist - Offshore", msrpRate: 112 },
  { name: "Application Specialist - Offshore", msrpRate: 95 },
  { name: "IT Architect", msrpRate: 340 },
  { name: "Sr. UX/AI Architect", msrpRate: 315 },
  { name: "UX/AI Architect", msrpRate: 285 },
  { name: "Technical Director", msrpRate: 265 },
  { name: "Technical Lead", msrpRate: 250 },
  { name: "Solution Engineer/Software Engineer", msrpRate: 250 },
  { name: "UX/AI Developer", msrpRate: 250 },
  { name: "Data Architect/System Architect", msrpRate: 250 },
  { name: "Principal Developer/Principal Technical Analyst/Sr. Techno-Func Analyst", msrpRate: 225 },
  { name: "Principal System Administrator/Principal DBA", msrpRate: 225 },
  { name: "Install/Upgrade Specialist III", msrpRate: 225 },
  { name: "Sr. Developer/Sr. Technical Analyst/Sr. Integration Specialist/Techno-Func III", msrpRate: 195 },
  { name: "Sr. System Admin/Sr. DBA", msrpRate: 195 },
  { name: "Install/Upgrade Specialist II", msrpRate: 195 },
  { name: "Developer III/Technical Analyst III/Sr. Techno-Func II", msrpRate: 167 },
  { name: "System Admin III/DBA III", msrpRate: 167 },
  { name: "Install/Upgrade Specialist I", msrpRate: 167 },
  { name: "Developer II/Technical Analyst II", msrpRate: 135 },
  { name: "System Admin II/DBA II", msrpRate: 135 },
  { name: "Developer I/Technical Analyst I", msrpRate: 100 },
  { name: "System Admin I/DBA I", msrpRate: 100 },
  { name: "Sr. System Admin - Nearshore", msrpRate: 178 },
  { name: "System Admin III - Nearshore", msrpRate: 150 },
  { name: "System Admin II - Nearshore", msrpRate: 115 },
  { name: "Sr. Developer - Nearshore", msrpRate: 135 },
  { name: "Developer III - Nearshore", msrpRate: 115 },
  { name: "Developer II - Nearshore", msrpRate: 100 },
  { name: "System Admin I - Nearshore", msrpRate: 90 },
  { name: "Developer I - Nearshore", msrpRate: 90 },
  { name: "Jr. Developer - Nearshore", msrpRate: 50 },
  { name: "Sr. System Admin - Offshore", msrpRate: 115 },
  { name: "System Admin I - Offshore", msrpRate: 105 },
  { name: "Developer II - Offshore", msrpRate: 100 },
  { name: "Developer I - Offshore", msrpRate: 90 },
];

async function main() {
  console.log("🗑️  Clearing existing role definitions...");
  await prisma.roleDefinition.deleteMany();

  console.log(`📋 Inserting ${roles.length} role definitions...`);
  await prisma.roleDefinition.createMany({ data: roles });

  console.log("✅ Done!");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
