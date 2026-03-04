"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { format, parseISO, startOfWeek, isBefore, isAfter } from "date-fns";
import { AllocationEntryType, ProjectType } from "@prisma/client";
import { cn, getUtilizationColor } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { updateAllocation, deleteAllocation } from "@/app/actions/utilization";
import { WeekCellEditor } from "./week-cell-editor";

export type DisplayMode = "all" | "billable" | "available" | "variance";

const BILLABLE_TYPES: ProjectType[] = [ProjectType.BILLABLE, ProjectType.ASSIGNED];

interface AllocationDetail {
  projectId: string;
  projectName: string;
  timecode: string;
  projectType: ProjectType;
  hours: number;
  entryType: AllocationEntryType;
  notes: string | null;
  createdBy: string | null;
  updatedAt: Date;
}

interface WeekCellProps {
  consultantId: string;
  consultantName: string;
  week: string;
  details: AllocationDetail[];
  standardHours: number;
  editable: boolean;
  displayMode: DisplayMode;
  projects: Array<{ id: string; projectName: string; timecode: string }>;
  roleDefinitions: Array<{ id: string; name: string; msrpRate: number }>;
  onSave?: (allocations: Array<{ projectId: string; projectedHours: number; actualHours: number; notes: string }>) => void;
}

function DiagonalLine({ className }: { className?: string }) {
  return (
    <svg
      className={cn("absolute inset-0 w-full h-full pointer-events-none", className)}
      viewBox="0 0 64 48"
      preserveAspectRatio="none"
    >
      <line
        x1="64" y1="0" x2="0" y2="48"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DiagonalLineSmall({ className }: { className?: string }) {
  return (
    <svg
      className={cn("absolute inset-0 w-full h-full pointer-events-none", className)}
      viewBox="0 0 64 40"
      preserveAspectRatio="none"
    >
      <line
        x1="64" y1="0" x2="0" y2="40"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function WeekCell({
  consultantId,
  consultantName,
  week,
  details,
  standardHours,
  editable,
  displayMode,
  projects,
  roleDefinitions,
  onSave,
}: WeekCellProps) {
  const [isEditing, setIsEditing] = useState(false);

  const weekDate = parseISO(week);
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isPast = isBefore(weekDate, currentWeekStart);

  const computed = useMemo(() => {
    const actualAll = details
      .filter(d => d.entryType === AllocationEntryType.ACTUAL)
      .reduce((sum, d) => sum + d.hours, 0);
    const projectedAll = details
      .filter(d => d.entryType === AllocationEntryType.PROJECTED)
      .reduce((sum, d) => sum + d.hours, 0);

    const billableActual = details
      .filter(d => d.entryType === AllocationEntryType.ACTUAL && BILLABLE_TYPES.includes(d.projectType))
      .reduce((sum, d) => sum + d.hours, 0);
    const billableProjected = details
      .filter(d => d.entryType === AllocationEntryType.PROJECTED && BILLABLE_TYPES.includes(d.projectType))
      .reduce((sum, d) => sum + d.hours, 0);

    // Coloring: always based on billable+assigned vs standard hours
    const colorBasis = isPast ? billableActual : billableProjected;
    const ratio = standardHours > 0 ? colorBasis / standardHours : 0;
    let status: "under" | "normal" | "over" = "normal";
    if (colorBasis > 0) {
      if (ratio < 0.9) status = "under";
      else if (ratio > 1.1) status = "over";
    }

    return { actualAll, projectedAll, billableActual, billableProjected, status };
  }, [details, standardHours, isPast]);

  const { actualAll, projectedAll, billableActual, billableProjected, status } = computed;

  // What the cell actually shows, per mode
  const displayTop = (() => {
    if (displayMode === "billable") return billableProjected;
    if (displayMode === "available") return isPast
      ? standardHours - billableActual
      : standardHours - billableProjected;
    if (displayMode === "variance") return isPast ? actualAll - projectedAll : null;
    return projectedAll; // "all"
  })();

  const displayBottom = (() => {
    if (!isPast) return null;
    if (displayMode === "billable") return billableActual;
    if (displayMode === "available" || displayMode === "variance") return null; // single number
    return actualAll; // "all"
  })();

  // For "available" and "variance" past weeks, use a single centered value
  const useSingleValue = displayMode === "available" || displayMode === "variance";

  const hasValue = isPast
    ? (actualAll > 0 || projectedAll > 0)
    : projectedAll > 0;
  const colorClass = hasValue ? getUtilizationColor(status) : "";

  const fmt = (n: number | null) => {
    if (n === null) return "—";
    if (displayMode === "variance" && n > 0) return `+${n}`;
    return n === 0 ? "-" : String(n);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "w-16 min-w-16 h-12 border-r transition-colors relative overflow-hidden",
              colorClass,
              editable && "hover:ring-2 hover:ring-primary hover:ring-inset cursor-pointer",
              !editable && "cursor-default"
            )}
            disabled={!editable}
            onClick={() => editable && setIsEditing(true)}
          >
            {isPast && !useSingleValue ? (
              <>
                <DiagonalLine />
                <span className="absolute top-0 left-1 text-xs leading-tight font-medium">
                  {fmt(displayTop)}
                </span>
                <span className="absolute bottom-0 right-1 text-xs leading-tight font-medium">
                  {fmt(displayBottom)}
                </span>
              </>
            ) : (
              <span className="flex items-center justify-center w-full h-full text-sm font-medium">
                {fmt(displayTop)}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium">
              Week of {format(weekDate, "MMM d, yyyy")}
              {isPast && <span className="text-muted-foreground ml-1">(Past)</span>}
            </div>
            <div className="text-sm space-y-1">
              <div>Projected: {projectedAll}h / {standardHours}h ({standardHours > 0 ? Math.round((projectedAll / standardHours) * 100) : 0}%)</div>
              {isPast && <div>Actual: {actualAll}h / {standardHours}h ({standardHours > 0 ? Math.round((actualAll / standardHours) * 100) : 0}%)</div>}
              {(billableProjected !== projectedAll || billableActual !== actualAll) && (
                <div className="text-muted-foreground">
                  Billable/Assigned proj: {billableProjected}h
                  {isPast && ` · actual: ${billableActual}h`}
                </div>
              )}
            </div>
            {details.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                {details.map((detail, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{detail.timecode}</span>: {detail.hours}h
                    <span className="text-muted-foreground text-xs ml-1">
                      ({detail.entryType === AllocationEntryType.ACTUAL ? "A" : "P"})
                    </span>
                    {detail.notes && <span className="text-muted-foreground"> - {detail.notes}</span>}
                  </div>
                ))}
              </div>
            )}
            {details.length === 0 && (
              <div className="text-sm text-muted-foreground">No allocations</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {editable && (
        <WeekCellEditor
          open={isEditing}
          onOpenChange={setIsEditing}
          consultantId={consultantId}
          consultantName={consultantName}
          week={week}
          standardHours={standardHours}
          details={details}
          projects={projects}
          roleDefinitions={roleDefinitions}
          onSave={onSave}
        />
      )}
    </>
  );
}

// --- Project-level cell and editor ---

interface ProjectWeekCellProps {
  consultantId: string;
  consultantName: string;
  week: string;
  projected: number;
  actual: number;
  notes?: string | null;
  projectId: string;
  projectName: string;
  timecode: string;
  editable: boolean;
  onSave?: (projectedHours: number, actualHours: number, notes: string) => void;
}

function ProjectCellEditor({
  open,
  onOpenChange,
  consultantId,
  consultantName,
  week,
  projected,
  actual,
  initialNotes,
  projectId,
  projectName,
  timecode,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantId: string;
  consultantName: string;
  week: string;
  projected: number;
  actual: number;
  initialNotes?: string | null;
  projectId: string;
  projectName: string;
  timecode: string;
  onSave?: (projectedHours: number, actualHours: number, notes: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [projectedHours, setProjectedHours] = useState(projected);
  const [actualHours, setActualHours] = useState(actual);
  const [notes, setNotes] = useState(initialNotes ?? "");

  const weekDate = parseISO(week);
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isPast = isBefore(weekDate, currentWeekStart);
  const isFuture = isAfter(weekDate, currentWeekStart);

  useEffect(() => {
    if (open) {
      setProjectedHours(projected);
      setActualHours(actual);
      setNotes(initialNotes ?? "");
      setError(null);
    }
  // Intentionally only re-init when the dialog opens (not on prop changes mid-edit)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        if (projectedHours > 0) {
          await updateAllocation(consultantId, week, projectId, projectedHours, AllocationEntryType.PROJECTED, notes || undefined);
        } else if (projected > 0) {
          await deleteAllocation(consultantId, projectId, week, AllocationEntryType.PROJECTED);
        }

        if (!isFuture) {
          if (actualHours > 0) {
            await updateAllocation(consultantId, week, projectId, actualHours, AllocationEntryType.ACTUAL, notes || undefined);
          } else if (actual > 0) {
            await deleteAllocation(consultantId, projectId, week, AllocationEntryType.ACTUAL);
          }
        }

        onSave?.(projectedHours, actualHours, notes);
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }, [consultantId, week, projectId, projectedHours, actualHours, notes, projected, actual, isFuture, onOpenChange, onSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{timecode} - {projectName}</DialogTitle>
          <DialogDescription>
            {consultantName} &middot; Week of {format(weekDate, "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">
              Projected Hours
              {isPast && <span className="text-muted-foreground"> (read-only)</span>}
            </Label>
            <Input
              type="number"
              min="0"
              max="80"
              step="0.5"
              value={projectedHours}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setProjectedHours(parseFloat(e.target.value) || 0)}
              disabled={isPast}
              className={isPast ? "bg-muted" : ""}
            />
          </div>
          {!isFuture && (
            <div className="space-y-1.5">
              <Label className="text-sm">Actual Hours</Label>
              <Input
                type="number"
                min="0"
                max="80"
                step="0.5"
                value={actualHours}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setActualHours(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a comment..."
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectWeekCell({
  consultantId,
  consultantName,
  week,
  projected,
  actual,
  notes,
  projectId,
  projectName,
  timecode,
  editable,
  onSave,
}: ProjectWeekCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const weekDate = parseISO(week);
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isPast = isBefore(weekDate, currentWeekStart);
  const hasValue = projected > 0 || actual > 0;

  const cellContent = isPast ? (
    <>
      <DiagonalLineSmall />
      <span className="absolute top-0 left-1 text-xs leading-tight text-muted-foreground">
        {projected > 0 ? projected : "-"}
      </span>
      <span className="absolute bottom-0 right-1 text-xs leading-tight text-muted-foreground">
        {actual > 0 ? actual : "-"}
      </span>
    </>
  ) : (
    <span className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">
      {projected > 0 ? projected : "-"}
    </span>
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          {editable ? (
            <button
              className={cn(
                "w-16 min-w-16 h-10 border-r relative overflow-hidden transition-colors",
                hasValue && "bg-muted/30",
                "hover:ring-2 hover:ring-primary hover:ring-inset cursor-pointer"
              )}
              onClick={() => setIsEditing(true)}
            >
              {cellContent}
            </button>
          ) : (
            <div
              className={cn(
                "w-16 min-w-16 h-10 border-r relative overflow-hidden",
                hasValue && "bg-muted/30"
              )}
            >
              {cellContent}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-medium text-sm">
              {timecode} - {projectName}
            </div>
            <div className="text-sm">
              Week of {format(weekDate, "MMM d, yyyy")}
            </div>
            <div className="text-sm">
              Projected: {projected}h
              {isPast && <> &middot; Actual: {actual}h</>}
            </div>
            {notes && <div className="text-xs text-muted-foreground">{notes}</div>}
          </div>
        </TooltipContent>
      </Tooltip>

      {editable && (
        <ProjectCellEditor
          open={isEditing}
          onOpenChange={setIsEditing}
          consultantId={consultantId}
          consultantName={consultantName}
          week={week}
          projected={projected}
          actual={actual}
          initialNotes={notes}
          projectId={projectId}
          projectName={projectName}
          timecode={timecode}
          onSave={onSave}
        />
      )}
    </>
  );
}
