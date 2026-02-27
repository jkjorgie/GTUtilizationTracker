"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PTOStatus, AllocationEntryType } from "@prisma/client";
import { startOfWeek, eachWeekOfInterval, parseISO, addDays, isAfter } from "date-fns";

const ptoSchema = z.object({
  consultantId: z.string().min(1, "Consultant is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  allDay: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export type PTOFormData = z.infer<typeof ptoSchema>;

export async function getPTORequests(filters?: {
  status?: PTOStatus;
  consultantId?: string;
}) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const where: {
    status?: PTOStatus;
    consultantId?: string | { in: string[] };
  } = {};

  // Filter by status if provided
  if (filters?.status) {
    where.status = filters.status;
  }

  // Role-based filtering
  if (session.user.role === "EMPLOYEE") {
    if (!session.user.consultantId) {
      return [];
    }
    where.consultantId = session.user.consultantId;
  } else if (session.user.role === "MANAGER") {
    if (!session.user.consultantId) {
      return [];
    }
    const directReports = await prisma.consultant.findMany({
      where: { managerId: session.user.consultantId },
      select: { id: true },
    });
    const directReportIds = directReports.map(c => c.id);
    if (filters?.consultantId) {
      if (directReportIds.includes(filters.consultantId)) {
        where.consultantId = filters.consultantId;
      } else {
        return [];
      }
    } else {
      where.consultantId = { in: directReportIds };
    }
  } else if (filters?.consultantId) {
    where.consultantId = filters.consultantId;
  }

  return prisma.pTORequest.findMany({
    where,
    include: {
      consultant: {
        select: { id: true, name: true },
      },
      approvedBy: {
        select: { id: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPTORequest(id: string) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const pto = await prisma.pTORequest.findUnique({
    where: { id },
    include: {
      consultant: true,
      approvedBy: {
        select: { email: true },
      },
    },
  });

  // Check access
  if (session.user.role === "EMPLOYEE" && pto?.consultantId !== session.user.consultantId) {
    throw new Error("Unauthorized");
  }

  return pto;
}

export async function createPTORequest(data: PTOFormData) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const validated = ptoSchema.parse(data);

  // Employees can only create PTO for themselves
  if (session.user.role === "EMPLOYEE" && validated.consultantId !== session.user.consultantId) {
    throw new Error("You can only submit PTO requests for yourself");
  }

  // Managers can only submit for themselves or their direct reports
  if (session.user.role === "MANAGER" && validated.consultantId !== session.user.consultantId) {
    const consultant = await prisma.consultant.findUnique({
      where: { id: validated.consultantId },
      select: { managerId: true },
    });
    if (consultant?.managerId !== session.user.consultantId) {
      throw new Error("You can only submit PTO for yourself or your direct reports");
    }
  }

  const pto = await prisma.pTORequest.create({
    data: {
      consultantId: validated.consultantId,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
      allDay: validated.allDay,
      startTime: validated.allDay ? null : validated.startTime,
      endTime: validated.allDay ? null : validated.endTime,
      status: PTOStatus.PENDING,
    },
  });

  revalidatePath("/pto");
  return pto;
}

export async function approvePTORequest(id: string) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const pto = await prisma.pTORequest.findUnique({
    where: { id },
    include: { consultant: true },
  });

  if (!pto) {
    throw new Error("PTO request not found");
  }

  if (session.user.role === "MANAGER") {
    const consultant = await prisma.consultant.findUnique({
      where: { id: pto.consultantId },
      select: { managerId: true },
    });
    if (consultant?.managerId !== session.user.consultantId) {
      throw new Error("You can only approve PTO for your direct reports");
    }
  }

  if (pto.status !== PTOStatus.PENDING) {
    throw new Error("PTO request is not pending");
  }

  // Find or create a PTO project
  let ptoProject = await prisma.project.findFirst({
    where: { timecode: "INT-PTO-001" },
  });

  if (!ptoProject) {
    ptoProject = await prisma.project.create({
      data: {
        client: "Internal",
        projectName: "PTO",
        timecode: "INT-PTO-001",
        type: "ASSIGNED",
        status: "ACTIVE",
      },
    });
  }

  // Calculate PTO hours and create allocations
  const weeks = eachWeekOfInterval(
    { start: pto.startDate, end: pto.endDate },
    { weekStartsOn: 0 }
  );

  let hoursPerDay = 8; // Default for all-day PTO

  if (!pto.allDay && pto.startTime && pto.endTime) {
    // Calculate hours from time range
    const [startHour, startMin] = pto.startTime.split(":").map(Number);
    const [endHour, endMin] = pto.endTime.split(":").map(Number);
    hoursPerDay = endHour - startHour + (endMin - startMin) / 60;
  }

  // Count business days in the PTO range
  let currentDate = new Date(pto.startDate);
  const endDate = new Date(pto.endDate);
  let totalDays = 0;

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not weekend
      totalDays++;
    }
    currentDate = addDays(currentDate, 1);
  }

  const totalPTOHours = totalDays * hoursPerDay;

  // Create allocation entries for each week
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });

  for (const weekStart of weeks) {
    // Calculate hours for this specific week
    const weekEnd = addDays(weekStart, 6);
    let weekDays = 0;
    let checkDate = new Date(Math.max(weekStart.getTime(), pto.startDate.getTime()));
    const weekEndDate = new Date(Math.min(weekEnd.getTime(), pto.endDate.getTime()));

    while (checkDate <= weekEndDate) {
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        weekDays++;
      }
      checkDate = addDays(checkDate, 1);
    }

    const weekHours = weekDays * hoursPerDay;

    if (weekHours > 0) {
      // Future weeks: use PROJECTED so they appear in the utilization planning grid.
      // Past/current weeks: use ACTUAL.
      const entryType = isAfter(startOfWeek(weekStart, { weekStartsOn: 0 }), currentWeekStart)
        ? AllocationEntryType.PROJECTED
        : AllocationEntryType.ACTUAL;

      await prisma.allocation.upsert({
        where: {
          consultantId_projectId_weekStart_entryType: {
            consultantId: pto.consultantId,
            projectId: ptoProject.id,
            weekStart: startOfWeek(weekStart, { weekStartsOn: 0 }),
            entryType,
          },
        },
        update: {
          hours: { increment: weekHours },
        },
        create: {
          consultantId: pto.consultantId,
          projectId: ptoProject.id,
          weekStart: startOfWeek(weekStart, { weekStartsOn: 0 }),
          hours: weekHours,
          entryType,
          notes: `PTO: ${pto.startDate.toLocaleDateString()} - ${pto.endDate.toLocaleDateString()}`,
          createdById: session.user.id,
        },
      });
    }
  }

  // Update PTO status
  const updatedPTO = await prisma.pTORequest.update({
    where: { id },
    data: {
      status: PTOStatus.APPROVED,
      approvedById: session.user.id,
    },
  });

  revalidatePath("/pto");
  revalidatePath("/utilization");
  return updatedPTO;
}

export async function denyPTORequest(id: string) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const pto = await prisma.pTORequest.findUnique({
    where: { id },
  });

  if (!pto) {
    throw new Error("PTO request not found");
  }

  if (session.user.role === "MANAGER") {
    const consultant = await prisma.consultant.findUnique({
      where: { id: pto.consultantId },
      select: { managerId: true },
    });
    if (consultant?.managerId !== session.user.consultantId) {
      throw new Error("You can only deny PTO for your direct reports");
    }
  }

  if (pto.status !== PTOStatus.PENDING) {
    throw new Error("PTO request is not pending");
  }

  const updatedPTO = await prisma.pTORequest.update({
    where: { id },
    data: {
      status: PTOStatus.DENIED,
      approvedById: session.user.id,
    },
  });

  revalidatePath("/pto");
  return updatedPTO;
}

export async function getConsultantsForPTO() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  if (session.user.role === "ADMIN") {
    return prisma.consultant.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  if (session.user.role === "MANAGER" && session.user.consultantId) {
    // Self + direct reports
    return prisma.consultant.findMany({
      where: {
        OR: [
          { id: session.user.consultantId },
          { managerId: session.user.consultantId },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // EMPLOYEE: just themselves
  if (session.user.consultantId) {
    return prisma.consultant.findMany({
      where: { id: session.user.consultantId },
      select: { id: true, name: true },
    });
  }

  return [];
}

export async function getPendingPTOCount(): Promise<number> {
  const session = await auth();
  if (!session) return 0;

  const where: { status: PTOStatus; consultantId?: string | { in: string[] } } = {
    status: PTOStatus.PENDING,
  };

  if (session.user.role === "EMPLOYEE") {
    if (!session.user.consultantId) return 0;
    where.consultantId = session.user.consultantId;
  } else if (session.user.role === "MANAGER") {
    if (!session.user.consultantId) return 0;
    const directReports = await prisma.consultant.findMany({
      where: { managerId: session.user.consultantId },
      select: { id: true },
    });
    const directReportIds = directReports.map((c) => c.id);
    where.consultantId = { in: directReportIds };
  }
  // ADMIN: no consultantId filter → all pending

  return prisma.pTORequest.count({ where });
}

export async function deletePTORequest(id: string) {
  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const pto = await prisma.pTORequest.findUnique({
    where: { id },
  });

  if (!pto) {
    throw new Error("PTO request not found");
  }

  // Only allow deletion of pending requests
  if (pto.status !== PTOStatus.PENDING) {
    throw new Error("Can only delete pending PTO requests");
  }

  // Employees can only delete their own PTO
  if (session.user.role === "EMPLOYEE" && pto.consultantId !== session.user.consultantId) {
    throw new Error("You can only delete your own PTO requests");
  }

  await prisma.pTORequest.delete({
    where: { id },
  });

  revalidatePath("/pto");
}
