import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  format,
  addWeeks,
  subWeeks,
  parseISO,
  isValid,
  startOfMonth,
  isBefore,
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the Sunday of the week for a given date
 */
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 }); // 0 = Sunday
}

/**
 * Get the Saturday (end) of the week for a given date
 */
export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 0 });
}

/**
 * Get all week start dates (Sundays) in a date range
 */
export function getWeeksInRange(startDate: Date, endDate: Date): Date[] {
  return eachWeekOfInterval(
    { start: startDate, end: endDate },
    { weekStartsOn: 0 }
  );
}

/**
 * Format a date as a short week label (e.g., "1/5")
 */
export function formatWeekLabel(date: Date): string {
  return format(date, "M/d");
}

/**
 * Format a date as month name (e.g., "January 2026")
 */
export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy");
}

/**
 * Format a date as ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Parse an ISO date string to Date
 */
export function parseDateISO(dateString: string): Date | null {
  const parsed = parseISO(dateString);
  return isValid(parsed) ? parsed : null;
}

/**
 * Get the first Sunday on or after the 1st of the current month
 */
export function getFirstFullWeekOfMonth(date: Date = new Date()): Date {
  const monthStart = startOfMonth(date);
  const weekOfMonthStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  return isBefore(weekOfMonthStart, monthStart)
    ? addWeeks(weekOfMonthStart, 1)
    : weekOfMonthStart;
}

/**
 * Get the default date range for utilization view
 * (first full week of current month, 13 weeks / ~3 months out)
 */
export function getDefaultDateRange(): { start: Date; end: Date } {
  const start = getFirstFullWeekOfMonth();
  return { start, end: addWeeks(start, 13) };
}

/**
 * Group weeks by month for the utilization header
 */
export function groupWeeksByMonth(weeks: Date[]): Map<string, Date[]> {
  const grouped = new Map<string, Date[]>();
  
  for (const week of weeks) {
    const monthKey = format(week, "yyyy-MM");
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(week);
  }
  
  return grouped;
}

/**
 * Calculate utilization status based on hours vs standard
 */
export function getUtilizationStatus(
  hours: number,
  standardHours: number
): "under" | "normal" | "over" {
  const ratio = hours / standardHours;
  if (ratio < 0.9) return "under";
  if (ratio > 1.1) return "over";
  return "normal";
}

/**
 * Get color class based on utilization status
 */
export function getUtilizationColor(status: "under" | "normal" | "over"): string {
  switch (status) {
    case "under":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
    case "over":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    case "normal":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
  }
}
