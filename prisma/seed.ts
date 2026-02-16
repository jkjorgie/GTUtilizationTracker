import { PrismaClient, UserRole, GroupType, RoleLevel, OvertimePreference, ProjectType, ProjectStatus, AllocationEntryType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { startOfWeek, addWeeks, subWeeks } from "date-fns";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data
  await prisma.allocation.deleteMany();
  await prisma.pTORequest.deleteMany();
  await prisma.consultantGroup.deleteMany();
  await prisma.consultantRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.consultant.deleteMany();
  await prisma.project.deleteMany();

  console.log("📋 Creating projects...");

  // Create projects
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        client: "Acme Corp",
        projectName: "Website Redesign",
        timecode: "ACME-WEB-001",
        type: ProjectType.BILLABLE,
        status: ProjectStatus.ACTIVE,
      },
    }),
    prisma.project.create({
      data: {
        client: "TechStart Inc",
        projectName: "Mobile App Development",
        timecode: "TECH-MOB-001",
        type: ProjectType.BILLABLE,
        status: ProjectStatus.ACTIVE,
      },
    }),
    prisma.project.create({
      data: {
        client: "Global Finance",
        projectName: "Data Analytics Platform",
        timecode: "GFIN-DAT-001",
        type: ProjectType.BILLABLE,
        status: ProjectStatus.ACTIVE,
      },
    }),
    prisma.project.create({
      data: {
        client: "Internal",
        projectName: "Training & Development",
        timecode: "INT-TRN-001",
        type: ProjectType.ASSIGNED,
        status: ProjectStatus.ACTIVE,
      },
    }),
    prisma.project.create({
      data: {
        client: "Internal",
        projectName: "Administrative Time",
        timecode: "INT-ADM-001",
        type: ProjectType.FILLER,
        status: ProjectStatus.ACTIVE,
      },
    }),
    prisma.project.create({
      data: {
        client: "Internal",
        projectName: "PTO",
        timecode: "INT-PTO-001",
        type: ProjectType.ASSIGNED,
        status: ProjectStatus.ACTIVE,
      },
    }),
    prisma.project.create({
      data: {
        client: "NewClient",
        projectName: "Potential Engagement",
        timecode: "NEW-POT-001",
        type: ProjectType.PROJECTED,
        status: ProjectStatus.ACTIVE,
      },
    }),
    prisma.project.create({
      data: {
        client: "OldClient",
        projectName: "Legacy System",
        timecode: "OLD-LEG-001",
        type: ProjectType.BILLABLE,
        status: ProjectStatus.INACTIVE,
      },
    }),
  ]);

  console.log("👥 Creating consultants...");

  // Create consultants
  const consultants = await Promise.all([
    prisma.consultant.create({
      data: {
        name: "Jane Smith",
        standardHours: 40,
        overtimePreference: OvertimePreference.LIMITED,
        overtimeHoursAvailable: 10,
        hrManager: "Sarah Johnson",
        groups: {
          create: [{ group: GroupType.TECH }, { group: GroupType.AI }],
        },
        roles: {
          create: [{ level: RoleLevel.LVL4 }],
        },
      },
    }),
    prisma.consultant.create({
      data: {
        name: "John Doe",
        standardHours: 40,
        overtimePreference: OvertimePreference.OPEN,
        overtimeHoursAvailable: 20,
        hrManager: "Sarah Johnson",
        groups: {
          create: [{ group: GroupType.SA }],
        },
        roles: {
          create: [{ level: RoleLevel.LVL3 }],
        },
      },
    }),
    prisma.consultant.create({
      data: {
        name: "Emily Chen",
        standardHours: 40,
        overtimePreference: OvertimePreference.NONE,
        overtimeHoursAvailable: 0,
        hrManager: "Mike Wilson",
        groups: {
          create: [{ group: GroupType.UX }],
        },
        roles: {
          create: [{ level: RoleLevel.LEAD }],
        },
      },
    }),
    prisma.consultant.create({
      data: {
        name: "Michael Brown",
        standardHours: 40,
        overtimePreference: OvertimePreference.LIMITED,
        overtimeHoursAvailable: 5,
        hrManager: "Mike Wilson",
        groups: {
          create: [{ group: GroupType.BA }, { group: GroupType.SA }],
        },
        roles: {
          create: [{ level: RoleLevel.LVL5 }],
        },
      },
    }),
    prisma.consultant.create({
      data: {
        name: "Sarah Davis",
        standardHours: 32,
        overtimePreference: OvertimePreference.NONE,
        overtimeHoursAvailable: 0,
        hrManager: "Sarah Johnson",
        groups: {
          create: [{ group: GroupType.TECH }],
        },
        roles: {
          create: [{ level: RoleLevel.LVL2 }],
        },
      },
    }),
    prisma.consultant.create({
      data: {
        name: "David Wilson",
        standardHours: 40,
        overtimePreference: OvertimePreference.OPEN,
        overtimeHoursAvailable: 15,
        hrManager: "Mike Wilson",
        groups: {
          create: [{ group: GroupType.AI }, { group: GroupType.TECH }],
        },
        roles: {
          create: [{ level: RoleLevel.LVL4 }, { level: RoleLevel.LEAD }],
        },
      },
    }),
  ]);

  console.log("🔐 Creating users...");

  // Create users with hashed passwords
  const hashedPassword = await bcrypt.hash("password123", 10);

  await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@company.com",
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: "manager@company.com",
        passwordHash: hashedPassword,
        role: UserRole.MANAGER,
        consultantId: consultants[2].id, // Emily Chen
      },
    }),
    prisma.user.create({
      data: {
        email: "jane@company.com",
        passwordHash: hashedPassword,
        role: UserRole.EMPLOYEE,
        consultantId: consultants[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: "john@company.com",
        passwordHash: hashedPassword,
        role: UserRole.EMPLOYEE,
        consultantId: consultants[1].id,
      },
    }),
  ]);

  console.log("📊 Creating allocations...");

  // Create sample allocations for the past 4 weeks and next 8 weeks
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  
  const weeks: Date[] = [];
  for (let i = -4; i <= 8; i++) {
    weeks.push(addWeeks(currentWeekStart, i));
  }

  // Create allocations for each consultant
  for (const consultant of consultants) {
    for (const week of weeks) {
      // Random billable project allocation
      const billableProject = projects[Math.floor(Math.random() * 3)]; // First 3 are billable
      const billableHours = Math.floor(Math.random() * 16) + 24; // 24-40 hours
      
      await prisma.allocation.create({
        data: {
          consultantId: consultant.id,
          projectId: billableProject.id,
          weekStart: week,
          hours: Math.min(billableHours, consultant.standardHours),
          entryType: AllocationEntryType.ACTUAL,
          notes: `Allocated to ${billableProject.projectName}`,
        },
      });

      // Add some internal time if not at full capacity
      const remainingHours = consultant.standardHours - billableHours;
      if (remainingHours > 0) {
        await prisma.allocation.create({
          data: {
            consultantId: consultant.id,
            projectId: projects[3].id, // Training & Development
            weekStart: week,
            hours: remainingHours,
            entryType: AllocationEntryType.ACTUAL,
          },
        });
      }

      // Create projected allocations for future weeks
      if (week >= currentWeekStart) {
        await prisma.allocation.create({
          data: {
            consultantId: consultant.id,
            projectId: projects[Math.floor(Math.random() * 3)].id,
            weekStart: week,
            hours: consultant.standardHours,
            entryType: AllocationEntryType.PROJECTED,
            notes: "Projected allocation",
          },
        });
      }
    }
  }

  console.log("🏖️ Creating PTO requests...");

  // Create some PTO requests
  const nextMonth = addWeeks(currentWeekStart, 4);
  
  await prisma.pTORequest.create({
    data: {
      consultantId: consultants[0].id,
      startDate: nextMonth,
      endDate: addWeeks(nextMonth, 1),
      allDay: true,
      status: "PENDING",
    },
  });

  await prisma.pTORequest.create({
    data: {
      consultantId: consultants[1].id,
      startDate: subWeeks(currentWeekStart, 2),
      endDate: subWeeks(currentWeekStart, 2),
      allDay: true,
      status: "APPROVED",
    },
  });

  console.log("✅ Seed completed successfully!");
  console.log("\n📝 Test accounts:");
  console.log("  Admin: admin@company.com / password123");
  console.log("  Manager: manager@company.com / password123");
  console.log("  Employee: jane@company.com / password123");
  console.log("  Employee: john@company.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
