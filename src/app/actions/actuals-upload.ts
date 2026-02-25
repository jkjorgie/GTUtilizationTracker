"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { startOfWeek, subWeeks, format as formatDate } from "date-fns";

export interface UnmatchedEntry {
  projectCode: string;
  projectFound: boolean;
  entries: Array<{
    employee: string;
    employeeFound: boolean;
    totalHours: number;
  }>;
}

export interface UploadResult {
  success: boolean;
  weekStart: string;
  dateRange: string;
  processed: {
    count: number;
    totalHours: number;
  };
  unmatched: UnmatchedEntry[];
  errors: string[];
}

function extractDateFromFilename(filename: string): Date | null {
  // YYYY-MM-DD
  const isoMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
    if (!isNaN(d.getTime())) return d;
  }
  // MM-DD-YYYY
  const usMatch = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (usMatch) {
    const d = new Date(+usMatch[3], +usMatch[1] - 1, +usMatch[2]);
    if (!isNaN(d.getTime())) return d;
  }
  // YYYYMMDD
  const compactMatch = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) {
    const d = new Date(+compactMatch[1], +compactMatch[2] - 1, +compactMatch[3]);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export async function processActualsUpload(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file provided");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
  });

  // 1. Derive weekStart from the filename date (previous week's Sunday)
  let weekStart: Date | null = null;
  let dateRange = "";

  const filenameDate = extractDateFromFilename(file.name);
  if (filenameDate) {
    weekStart = subWeeks(startOfWeek(filenameDate, { weekStartsOn: 0 }), 1);
  }

  // 2. Scan first ~10 rows for a date range string (used for display only;
  //    also serves as fallback weekStart when filename has no date)
  const datePattern = /^(\w+ \d{1,2}, \d{4})\s*-\s*(\w+ \d{1,2}, \d{4})$/;
  for (const row of rows.slice(0, 10)) {
    const cell = row?.[0]?.toString().trim();
    if (cell) {
      const match = cell.match(datePattern);
      if (match) {
        dateRange = cell;
        if (!weekStart) {
          const startDate = new Date(match[1]);
          if (!isNaN(startDate.getTime())) {
            weekStart = startOfWeek(startDate, { weekStartsOn: 0 });
          }
        }
        break;
      }
    }
  }

  // If still no weekStart, generate dateRange from computed weekStart for display
  if (weekStart && !dateRange) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    dateRange = `${formatDate(weekStart, "MMMM d, yyyy")} - ${formatDate(weekEnd, "MMMM d, yyyy")}`;
  }

  if (!weekStart) {
    return {
      success: false,
      weekStart: "",
      dateRange: "",
      processed: { count: 0, totalHours: 0 },
      unmatched: [],
      errors: [
        "Could not determine the week to import. Include a date in the filename (e.g. 2026-02-24_PMReport.xlsx) or ensure the spreadsheet has a date range in the first few rows.",
      ],
    };
  }

  // 2. Find header row by looking for Customer/Job, Employee, Time columns
  let headerIdx = -1;
  let colCustomerJob = -1;
  let colEmployee = -1;
  let colTime = -1;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.map((c) => c?.toString().trim().toLowerCase() ?? "");
    const custIdx = cells.findIndex((c) => c.startsWith("customer/job"));
    const empIdx = cells.findIndex((c) => c.startsWith("employee"));
    const timeIdx = cells.findIndex((c) => c.startsWith("time"));
    if (custIdx >= 0 && empIdx >= 0 && timeIdx >= 0) {
      headerIdx = i;
      colCustomerJob = custIdx;
      colEmployee = empIdx;
      colTime = timeIdx;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      success: false,
      weekStart: "",
      dateRange: "",
      processed: { count: 0, totalHours: 0 },
      unmatched: [],
      errors: [
        'Could not find a header row with "Customer/Job", "Employee", and "Time" columns.',
      ],
    };
  }

  // 3. Parse and aggregate hours by projectCode + employee
  const aggregated = new Map<string, number>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const customerJob = row[colCustomerJob]?.toString().trim() ?? "";
    const employee = row[colEmployee]
      ?.toString()
      .trim()
      .replace(/\s+/g, " ") ?? "";
    const hours = parseFloat(String(row[colTime] ?? "")) || 0;

    if (!customerJob || !employee || hours === 0) continue;
    if (customerJob.toLowerCase() === "total") continue;

    const parts = customerJob.split(" : ");
    const projectCode = parts[parts.length - 1].trim();
    if (!projectCode) continue;

    const key = `${projectCode}|||${employee}`;
    aggregated.set(key, (aggregated.get(key) || 0) + hours);
  }

  // 4. Match project codes and employee names against the database
  const allProjects = await prisma.project.findMany({
    select: { id: true, timecode: true },
  });
  const projectMap = new Map(
    allProjects.map((p) => [p.timecode.toLowerCase(), p.id])
  );

  const allConsultants = await prisma.consultant.findMany({
    select: { id: true, name: true },
  });
  const consultantMap = new Map(
    allConsultants.map((c) => [
      c.name.toLowerCase().replace(/\s+/g, " "),
      c.id,
    ])
  );

  const matched: Array<{
    consultantId: string;
    projectId: string;
    hours: number;
    projectCode: string;
    employee: string;
  }> = [];

  const unmatchedMap = new Map<
    string,
    {
      projectFound: boolean;
      entries: Map<string, { employeeFound: boolean; totalHours: number }>;
    }
  >();

  for (const [key, hours] of aggregated) {
    const [projectCode, employee] = key.split("|||");
    const projectId = projectMap.get(projectCode.toLowerCase());
    const consultantId = consultantMap.get(
      employee.toLowerCase().replace(/\s+/g, " ")
    );

    if (projectId && consultantId) {
      matched.push({ consultantId, projectId, hours, projectCode, employee });
    } else {
      if (!unmatchedMap.has(projectCode)) {
        unmatchedMap.set(projectCode, {
          projectFound: !!projectId,
          entries: new Map(),
        });
      }
      const group = unmatchedMap.get(projectCode)!;
      if (!group.entries.has(employee)) {
        group.entries.set(employee, {
          employeeFound: !!consultantId,
          totalHours: 0,
        });
      }
      group.entries.get(employee)!.totalHours += hours;
    }
  }

  // 5. Upsert matched allocations as ACTUAL entries
  const errors: string[] = [];
  let processedCount = 0;
  let processedHours = 0;

  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  const createdById = userExists ? session.user.id : null;

  for (const entry of matched) {
    try {
      await prisma.allocation.upsert({
        where: {
          consultantId_projectId_weekStart_entryType: {
            consultantId: entry.consultantId,
            projectId: entry.projectId,
            weekStart: weekStart,
            entryType: "ACTUAL",
          },
        },
        update: {
          hours: entry.hours,
        },
        create: {
          consultantId: entry.consultantId,
          projectId: entry.projectId,
          weekStart: weekStart,
          hours: entry.hours,
          entryType: "ACTUAL",
          createdById,
        },
      });
      processedCount++;
      processedHours += entry.hours;
    } catch (err) {
      errors.push(
        `Failed to save ${entry.employee} on ${entry.projectCode}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  revalidatePath("/utilization");

  // 6. Build the unmatched report sorted by project code, then employee
  const unmatched: UnmatchedEntry[] = Array.from(unmatchedMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([projectCode, group]) => ({
      projectCode,
      projectFound: group.projectFound,
      entries: Array.from(group.entries.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([employee, data]) => ({
          employee,
          employeeFound: data.employeeFound,
          totalHours: data.totalHours,
        })),
    }));

  return {
    success: true,
    weekStart: weekStart.toISOString(),
    dateRange,
    processed: { count: processedCount, totalHours: processedHours },
    unmatched,
    errors,
  };
}
