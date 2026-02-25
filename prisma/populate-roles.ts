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

const roles: { category: string; name: string; msrpRate: number }[] = [
  // Management/Oversight
  { category: "Management/Oversight", name: "Strategy Consultant", msrpRate: 340 },
  { category: "Management/Oversight", name: "Sr. Project Manager", msrpRate: 260 },
  { category: "Management/Oversight", name: "Project Manager", msrpRate: 225 },
  { category: "Management/Oversight", name: "Engagement Manager", msrpRate: 225 },
  { category: "Management/Oversight", name: "Sr. Project Administrator", msrpRate: 195 },
  { category: "Management/Oversight", name: "Project Administrator III", msrpRate: 167 },
  { category: "Management/Oversight", name: "Project Administrator II", msrpRate: 135 },
  { category: "Management/Oversight", name: "Project Administrator I", msrpRate: 100 },
  // CM/Testing/QA/Training
  { category: "CM/Testing/QA/Training", name: "Change Management/QA/Testing Lead", msrpRate: 255 },
  { category: "CM/Testing/QA/Training", name: "Testing Manager", msrpRate: 230 },
  { category: "CM/Testing/QA/Training", name: "Sr. QA Specialist/Sr. Change Management Specialist", msrpRate: 200 },
  { category: "CM/Testing/QA/Training", name: "QA Specialist III/Change Management Specialist III", msrpRate: 170 },
  { category: "CM/Testing/QA/Training", name: "QA Specialist II/Change Management Specialist II", msrpRate: 140 },
  { category: "CM/Testing/QA/Training", name: "QA Specialist I/Change Management Specialist I", msrpRate: 105 },
  { category: "CM/Testing/QA/Training", name: "Sr. Training Specialist/Training Lead", msrpRate: 230 },
  { category: "CM/Testing/QA/Training", name: "Training Specialist", msrpRate: 200 },
  // Functional
  { category: "Functional", name: "Solution Architect", msrpRate: 250 },
  { category: "Functional", name: "Sr. Process & Content Architect", msrpRate: 250 },
  { category: "Functional", name: "Content Architect", msrpRate: 225 },
  { category: "Functional", name: "Lead BA/Lead Application Specialist", msrpRate: 250 },
  { category: "Functional", name: "Functional Lead/Principal BA", msrpRate: 225 },
  { category: "Functional", name: "Sr. BA/Application Specialist", msrpRate: 195 },
  { category: "Functional", name: "Sr. Business Process Specialist", msrpRate: 235 },
  { category: "Functional", name: "Business Process Specialist", msrpRate: 220 },
  { category: "Functional", name: "Functional Analyst III/RPA BA III/Application Specialist III", msrpRate: 167 },
  { category: "Functional", name: "Functional Analyst II/RPA BA II/Application Specialist II", msrpRate: 135 },
  { category: "Functional", name: "Functional Analyst I/RPA BA I/Application Specialist I", msrpRate: 100 },
  { category: "Functional", name: "Sr. Visual Designer", msrpRate: 195 },
  { category: "Functional", name: "Visual Designer III", msrpRate: 167 },
  { category: "Functional", name: "Visual Designer II", msrpRate: 135 },
  { category: "Functional", name: "Visual Designer I", msrpRate: 100 },
  { category: "Functional", name: "Lead Computational Linguist", msrpRate: 250 },
  { category: "Functional", name: "Sr. Computational Linguist", msrpRate: 195 },
  { category: "Functional", name: "Computational Linguist III", msrpRate: 167 },
  { category: "Functional", name: "Computational Linguist II", msrpRate: 135 },
  { category: "Functional", name: "Computational Linguist I", msrpRate: 100 },
  { category: "Functional", name: "Sr. BA/Application Specialist - Nearshore", msrpRate: 150 },
  { category: "Functional", name: "FA/Application Specialist III - Nearshore", msrpRate: 130 },
  { category: "Functional", name: "FA/Application Specialist II - Nearshore", msrpRate: 115 },
  { category: "Functional", name: "FA/Application Specialist I - Nearshore", msrpRate: 100 },
  { category: "Functional", name: "Jr. BA/Application Specialist - Nearshore", msrpRate: 50 },
  { category: "Functional", name: "Business Process Specialist - Offshore", msrpRate: 112 },
  { category: "Functional", name: "Application Specialist - Offshore", msrpRate: 95 },
  // Technical
  { category: "Technical", name: "IT Architect", msrpRate: 340 },
  { category: "Technical", name: "Sr. UX/AI Architect", msrpRate: 315 },
  { category: "Technical", name: "UX/AI Architect", msrpRate: 285 },
  { category: "Technical", name: "Technical Director", msrpRate: 265 },
  { category: "Technical", name: "Technical Lead", msrpRate: 250 },
  { category: "Technical", name: "Solution Engineer/Software Engineer", msrpRate: 250 },
  { category: "Technical", name: "UX/AI Developer", msrpRate: 250 },
  { category: "Technical", name: "Data Architect/System Architect", msrpRate: 250 },
  { category: "Technical", name: "Principal Developer/Principal Technical Analyst/Sr. Techno-Func Analyst", msrpRate: 225 },
  { category: "Technical", name: "Principal System Administrator/Principal DBA", msrpRate: 225 },
  { category: "Technical", name: "Install/Upgrade Specialist III", msrpRate: 225 },
  { category: "Technical", name: "Sr. Developer/Sr. Technical Analyst/Sr. Integration Specialist/Techno-Func III", msrpRate: 195 },
  { category: "Technical", name: "Sr. System Admin/Sr. DBA", msrpRate: 195 },
  { category: "Technical", name: "Install/Upgrade Specialist II", msrpRate: 195 },
  { category: "Technical", name: "Developer III/Technical Analyst III/Sr. Techno-Func II", msrpRate: 167 },
  { category: "Technical", name: "System Admin III/DBA III", msrpRate: 167 },
  { category: "Technical", name: "Install/Upgrade Specialist I", msrpRate: 167 },
  { category: "Technical", name: "Developer II/Technical Analyst II", msrpRate: 135 },
  { category: "Technical", name: "System Admin II/DBA II", msrpRate: 135 },
  { category: "Technical", name: "Developer I/Technical Analyst I", msrpRate: 100 },
  { category: "Technical", name: "System Admin I/DBA I", msrpRate: 100 },
  { category: "Technical", name: "Sr. System Admin - Nearshore", msrpRate: 178 },
  { category: "Technical", name: "System Admin III - Nearshore", msrpRate: 150 },
  { category: "Technical", name: "System Admin II - Nearshore", msrpRate: 115 },
  { category: "Technical", name: "Sr. Developer - Nearshore", msrpRate: 135 },
  { category: "Technical", name: "Developer III - Nearshore", msrpRate: 115 },
  { category: "Technical", name: "Developer II - Nearshore", msrpRate: 100 },
  { category: "Technical", name: "System Admin I - Nearshore", msrpRate: 90 },
  { category: "Technical", name: "Developer I - Nearshore", msrpRate: 90 },
  { category: "Technical", name: "Jr. Developer - Nearshore", msrpRate: 50 },
  { category: "Technical", name: "Sr. System Admin - Offshore", msrpRate: 115 },
  { category: "Technical", name: "System Admin I - Offshore", msrpRate: 105 },
  { category: "Technical", name: "Developer II - Offshore", msrpRate: 100 },
  { category: "Technical", name: "Developer I - Offshore", msrpRate: 90 },
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
