"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AllocationEntryType } from "@prisma/client";
import { eachWeekOfInterval, startOfWeek } from "date-fns";

const massLoadSchema = z.object({
  consultantIds: z.array(z.string()).min(1, "Select at least one consultant"),
  projectId: z.string().min(1, "Project is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  hours: z.number().min(0.5).max(80),
  entryType: z.nativeEnum(AllocationEntryType),
  notes: z.string().optional(),
});

export type MassLoadFormData = z.infer<typeof massLoadSchema>;

export async function createMassLoad(data: MassLoadFormData) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const validated = massLoadSchema.parse(data);

  const startDate = new Date(validated.startDate);
  const endDate = validated.endDate ? new Date(validated.endDate) : startDate;

  // Get all weeks in the range
  const weeks = eachWeekOfInterval(
    { start: startDate, end: endDate },
    { weekStartsOn: 0 }
  );

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: validated.projectId },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Create allocations for each consultant and week
  const results = {
    created: 0,
    updated: 0,
    errors: [] as string[],
  };

  for (const consultantId of validated.consultantIds) {
    // Verify consultant exists
    const consultant = await prisma.consultant.findUnique({
      where: { id: consultantId },
    });

    if (!consultant) {
      results.errors.push(`Consultant ${consultantId} not found`);
      continue;
    }

    for (const week of weeks) {
      const weekStart = startOfWeek(week, { weekStartsOn: 0 });

      try {
        // Check if allocation exists
        const existing = await prisma.allocation.findUnique({
          where: {
            consultantId_projectId_weekStart_entryType: {
              consultantId,
              projectId: validated.projectId,
              weekStart,
              entryType: validated.entryType,
            },
          },
        });

        if (existing) {
          // Update existing allocation
          await prisma.allocation.update({
            where: { id: existing.id },
            data: {
              hours: validated.hours,
              notes: validated.notes || existing.notes,
            },
          });
          results.updated++;
        } else {
          // Create new allocation
          await prisma.allocation.create({
            data: {
              consultantId,
              projectId: validated.projectId,
              weekStart,
              hours: validated.hours,
              entryType: validated.entryType,
              notes: validated.notes,
              createdById: session.user.id,
            },
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push(
          `Failed for ${consultant.name} on ${weekStart.toLocaleDateString()}`
        );
      }
    }
  }

  revalidatePath("/utilization");
  revalidatePath("/mass-load");

  return results;
}

export async function previewMassLoad(data: MassLoadFormData) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const validated = massLoadSchema.parse(data);

  const startDate = new Date(validated.startDate);
  const endDate = validated.endDate ? new Date(validated.endDate) : startDate;

  const weeks = eachWeekOfInterval(
    { start: startDate, end: endDate },
    { weekStartsOn: 0 }
  );

  const consultants = await prisma.consultant.findMany({
    where: { id: { in: validated.consultantIds } },
    select: { id: true, name: true },
  });

  const project = await prisma.project.findUnique({
    where: { id: validated.projectId },
    select: { projectName: true, timecode: true },
  });

  return {
    consultantCount: consultants.length,
    consultantNames: consultants.map((c) => c.name),
    weekCount: weeks.length,
    totalAllocations: consultants.length * weeks.length,
    totalHours: consultants.length * weeks.length * validated.hours,
    project: project
      ? `${project.projectName} (${project.timecode})`
      : "Unknown",
  };
}
