"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AllocationEntryType, OtherInvoiceStatus } from "@prisma/client";
import { getSystemSetting } from "./system-settings";
import { encrypt, encryptNullable, decrypt, decryptNullable } from "@/lib/encryption";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ANCHOR = "2025-01-05"; // First Sunday of 2025

function getPeriodStart(date: Date, anchor: Date): Date {
  const daysSinceAnchor = Math.floor(
    (date.getTime() - anchor.getTime()) / MS_PER_DAY
  );
  const periodIndex = Math.floor(daysSinceAnchor / 14);
  return new Date(anchor.getTime() + periodIndex * 14 * MS_PER_DAY);
}

export type PeriodRow = {
  consultantId: string;
  consultantName: string;
  weekStart: string;
  hours: number;
  entryType: "ACTUAL" | "PROJECTED";
};

export type InvoicePeriodData = {
  periodStart: string;
  periodEnd: string;
  status: "projected" | "reported" | "invoiced";
  msrpTotal: number;
  discountedTotal: number;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  comments: string | null;
  invoicePeriodId: string | null;
  rows: PeriodRow[];
};

export type OtherInvoiceData = {
  id: string;
  date: string;
  invoiceNumber: string | null;
  description: string | null;
  amount: number;
  status: OtherInvoiceStatus;
  invoiceDate: string | null;
};

export type InvoicingData = {
  project: {
    id: string;
    client: string;
    projectName: string;
    budget: number | null;
    currency: string;
    salesDiscount: number | null;
    comments: string | null;
  };
  billablePeriods: InvoicePeriodData[];
  nonBillablePeriods: InvoicePeriodData[];
  otherInvoices: OtherInvoiceData[];
  headerTotals: {
    totalBudget: number | null;
    totalUsed: number;
    totalProjected: number;
    totalRemaining: number | null;
  };
};

export async function getInvoicingData(projectId: string): Promise<InvoicingData> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const anchorDateStr = (await getSystemSetting("BILLING_PERIOD_ANCHOR")) ?? DEFAULT_ANCHOR;
  const anchorDate = new Date(anchorDateStr + "T00:00:00Z");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          consultant: { select: { id: true, name: true } },
          roleDefinition: { select: { id: true, name: true, msrpRate: true } },
        },
      },
      allocations: { orderBy: { weekStart: "asc" } },
      invoicePeriods: true,
      otherInvoices: { orderBy: { date: "asc" } },
    },
  });

  if (!project) throw new Error("Project not found");

  // Build member lookup by consultantId
  const memberMap = new Map(project.members.map((m) => [m.consultantId, m]));

  // Group allocations by billing period key
  const periodAllocMap = new Map<string, typeof project.allocations>();
  for (const alloc of project.allocations) {
    const ps = getPeriodStart(alloc.weekStart, anchorDate);
    const key = ps.toISOString();
    if (!periodAllocMap.has(key)) periodAllocMap.set(key, []);
    periodAllocMap.get(key)!.push(alloc);
  }

  // Build InvoicePeriod lookup by (periodStart iso, isBillable)
  const invoicePeriodMap = new Map<string, (typeof project.invoicePeriods)[0]>();
  for (const ip of project.invoicePeriods) {
    const key = `${ip.periodStart.toISOString()}_${ip.isBillable}`;
    invoicePeriodMap.set(key, ip);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const billablePeriods: InvoicePeriodData[] = [];
  const nonBillablePeriods: InvoicePeriodData[] = [];

  const sortedPeriodKeys = [...periodAllocMap.keys()].sort();

  for (const periodKey of sortedPeriodKeys) {
    const allocs = periodAllocMap.get(periodKey)!;
    const periodStart = new Date(periodKey);
    const periodEnd = new Date(periodStart.getTime() + 13 * MS_PER_DAY);

    // Split by billable (has billingRate) vs non-billable
    const billableAllocs = allocs.filter((a) => {
      const m = memberMap.get(a.consultantId);
      return m && m.billingRate != null;
    });
    const nonBillableAllocs = allocs.filter((a) => {
      const m = memberMap.get(a.consultantId);
      return !m || m.billingRate == null;
    });

    const buildPeriodData = (
      filteredAllocs: typeof project.allocations,
      isBillable: boolean
    ): InvoicePeriodData | null => {
      if (filteredAllocs.length === 0) return null;

      const existingPeriod = invoicePeriodMap.get(`${periodStart.toISOString()}_${isBillable}`);

      // Build rows: per consultant per week, prefer ACTUAL for past weeks, PROJECTED for future
      const rowMap = new Map<
        string,
        { consultantId: string; consultantName: string; weekStart: Date; hours: number; entryType: AllocationEntryType }
      >();

      for (const alloc of filteredAllocs) {
        const weekEnd = new Date(alloc.weekStart.getTime() + 6 * MS_PER_DAY);
        const isPastWeek = today > weekEnd;
        const rowKey = `${alloc.consultantId}_${alloc.weekStart.toISOString()}`;
        const existing = rowMap.get(rowKey);

        const preferredType = isPastWeek ? AllocationEntryType.ACTUAL : AllocationEntryType.PROJECTED;
        const isPreferred = alloc.entryType === preferredType;

        if (!existing || isPreferred) {
          const member = memberMap.get(alloc.consultantId);
          rowMap.set(rowKey, {
            consultantId: alloc.consultantId,
            consultantName: member ? decrypt(member.consultant.name) : "Unknown",
            weekStart: alloc.weekStart,
            hours: alloc.hours,
            entryType: alloc.entryType,
          });
        }
      }

      const rows = [...rowMap.values()].sort((a, b) => {
        const weekDiff = a.weekStart.getTime() - b.weekStart.getTime();
        return weekDiff !== 0 ? weekDiff : a.consultantName.localeCompare(b.consultantName);
      });

      // Compute MSRP
      let msrpTotal = 0;
      if (isBillable) {
        for (const row of rows) {
          const msrpRate = memberMap.get(row.consultantId)?.roleDefinition?.msrpRate ?? 0;
          msrpTotal += row.hours * msrpRate;
        }
      } else {
        // For non-billable, show what the cost would have been (for visibility)
        for (const row of rows) {
          const msrpRate = memberMap.get(row.consultantId)?.roleDefinition?.msrpRate ?? 0;
          msrpTotal += row.hours * msrpRate;
        }
      }

      const salesDiscount = project.salesDiscount ?? 0;
      const discountedTotal = msrpTotal * (1 - salesDiscount / 100);

      const hasActuals = rows.some((r) => r.entryType === AllocationEntryType.ACTUAL);
      let status: "projected" | "reported" | "invoiced" = "projected";
      if (isBillable && existingPeriod?.invoiceNumber) {
        status = "invoiced";
      } else if (hasActuals) {
        status = "reported";
      }

      return {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        status,
        msrpTotal,
        discountedTotal,
        invoiceNumber: existingPeriod?.invoiceNumber ?? null,
        invoiceDate: existingPeriod?.invoiceDate?.toISOString() ?? null,
        comments: existingPeriod?.comments ?? null,
        invoicePeriodId: existingPeriod?.id ?? null,
        rows: rows.map((r) => ({
          consultantId: r.consultantId,
          consultantName: r.consultantName,
          weekStart: r.weekStart.toISOString(),
          hours: r.hours,
          entryType: r.entryType as "ACTUAL" | "PROJECTED",
        })),
      };
    };

    const billablePeriod = buildPeriodData(billableAllocs, true);
    if (billablePeriod) billablePeriods.push(billablePeriod);

    const nonBillablePeriod = buildPeriodData(nonBillableAllocs, false);
    if (nonBillablePeriod) nonBillablePeriods.push(nonBillablePeriod);
  }

  // Header totals from billable periods only
  let totalUsed = 0;
  let totalProjected = 0;
  for (const p of billablePeriods) {
    if (p.status === "invoiced" || p.status === "reported") {
      totalUsed += p.discountedTotal;
    } else {
      totalProjected += p.discountedTotal;
    }
  }
  const totalBudget = project.budget;
  const totalRemaining = totalBudget != null ? totalBudget - totalUsed - totalProjected : null;

  return {
    project: {
      id: project.id,
      client: decrypt(project.client),
      projectName: decrypt(project.projectName),
      budget: project.budget,
      currency: project.currency,
      salesDiscount: project.salesDiscount,
      comments: decryptNullable(project.comments),
    },
    billablePeriods,
    nonBillablePeriods,
    otherInvoices: project.otherInvoices.map((oi) => ({
      id: oi.id,
      date: oi.date.toISOString(),
      invoiceNumber: oi.invoiceNumber,
      description: decryptNullable(oi.description),
      amount: oi.amount,
      status: oi.status,
      invoiceDate: oi.invoiceDate ? oi.invoiceDate.toISOString() : null,
    })),
    headerTotals: { totalBudget, totalUsed, totalProjected, totalRemaining },
  };
}

export async function upsertInvoicePeriod(data: {
  projectId: string;
  periodStart: string;
  isBillable: boolean;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  comments?: string | null;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const ps = new Date(data.periodStart);

  await prisma.invoicePeriod.upsert({
    where: {
      projectId_periodStart_isBillable: {
        projectId: data.projectId,
        periodStart: ps,
        isBillable: data.isBillable,
      },
    },
    update: {
      invoiceNumber: data.invoiceNumber ?? null,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
      comments: data.comments ?? null,
    },
    create: {
      projectId: data.projectId,
      periodStart: ps,
      isBillable: data.isBillable,
      invoiceNumber: data.invoiceNumber ?? null,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
      comments: data.comments ?? null,
    },
  });

  revalidatePath("/invoicing");
}

export async function updateProjectInvoiceComments(projectId: string, comments: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.project.update({
    where: { id: projectId },
    data: { comments: encryptNullable(comments) },
  });

  revalidatePath("/invoicing");
}

export async function createOtherInvoice(data: {
  projectId: string;
  date: string;
  invoiceNumber?: string | null;
  description?: string | null;
  amount: number;
  status?: OtherInvoiceStatus;
  invoiceDate?: string | null;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.otherInvoice.create({
    data: {
      projectId: data.projectId,
      date: new Date(data.date),
      invoiceNumber: data.invoiceNumber ?? null,
      description: encryptNullable(data.description ?? null),
      amount: data.amount,
      status: data.status ?? OtherInvoiceStatus.EXPECTED,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
    },
  });

  revalidatePath("/invoicing");
}

export async function updateOtherInvoice(
  id: string,
  data: {
    date?: string;
    invoiceNumber?: string | null;
    description?: string | null;
    amount?: number;
    status?: OtherInvoiceStatus;
    invoiceDate?: string | null;
  }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.otherInvoice.update({
    where: { id },
    data: {
      ...(data.date && { date: new Date(data.date) }),
      invoiceNumber: data.invoiceNumber ?? null,
      description: encryptNullable(data.description ?? null),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.status !== undefined && { status: data.status }),
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
    },
  });

  revalidatePath("/invoicing");
}

export async function deleteOtherInvoice(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.otherInvoice.delete({ where: { id } });
  revalidatePath("/invoicing");
}
