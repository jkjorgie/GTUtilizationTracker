"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { format, parseISO, startOfWeek, isBefore, isAfter } from "date-fns";
import { AllocationEntryType } from "@prisma/client";
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
import { Loader2 } from "lucide-react";
import { updateAllocation, deleteAllocation } from "@/app/actions/utilization";
import { WeekCellEditor } from "./week-cell-editor";

interface AllocationDetail {
  projectId: string;
  projectName: string;
  timecode: string;
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
  projects: Array<{ id: string; projectName: string; timecode: string }>;
  roleDefinitions: Array<{ id: string; name: string; msrpRate: number }>;
  onSave?: (allocations: Array<{ projectId: string; projectedHours: number; actualHours: number }>) => void;
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
  projects,
  roleDefinitions,
  onSave,
}: WeekCellProps) {
  const [isEditing, setIsEditing] = useState(false);

  const weekDate = parseISO(week);
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isPast = isBefore(weekDate, currentWeekStart);

  const { projectedTotal, actualTotal, status } = useMemo(() => {
    const actualTotal = details
      .filter(d => d.entryType === AllocationEntryType.ACTUAL)
      .reduce((sum, d) => sum + d.hours, 0);
    const projectedTotal = details
      .filter(d => d.entryType === AllocationEntryType.PROJECTED)
      .reduce((sum, d) => sum + d.hours, 0);

    const relevantTotal = isPast ? actualTotal : projectedTotal;
    const ratio = standardHours > 0 ? relevantTotal / standardHours : 0;
    let status: "under" | "normal" | "over" = "normal";
    if (relevantTotal > 0) {
      if (ratio < 0.9) status = "under";
      else if (ratio > 1.1) status = "over";
    }

    return { projectedTotal, actualTotal, status };
  }, [details, standardHours, isPast]);

  const hasValue = isPast ? (actualTotal > 0 || projectedTotal > 0) : projectedTotal > 0;
  const colorClass = hasValue ? getUtilizationColor(status) : "";

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
            {isPast ? (
              <>
                <DiagonalLine />
                <span className="absolute top-0 left-1 text-xs leading-tight font-medium">
                  {projectedTotal > 0 ? projectedTotal : "-"}
                </span>
                <span className="absolute bottom-0 right-1 text-xs leading-tight font-medium">
                  {actualTotal > 0 ? actualTotal : "-"}
                </span>
              </>
            ) : (
              <span className="flex items-center justify-center w-full h-full text-sm font-medium">
                {projectedTotal > 0 ? projectedTotal : "-"}
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
              <div>
                Projected: {projectedTotal}h / {standardHours}h
                ({standardHours > 0 ? Math.round((projectedTotal / standardHours) * 100) : 0}%)
              </div>
              {isPast && (
                <div>
                  Actual: {actualTotal}h / {standardHours}h
                  ({standardHours > 0 ? Math.round((actualTotal / standardHours) * 100) : 0}%)
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
                    {detail.notes && (
                      <span className="text-muted-foreground"> - {detail.notes}</span>
                    )}
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
  projectId: string;
  projectName: string;
  timecode: string;
  editable: boolean;
  onSave?: (projectedHours: number, actualHours: number) => void;
}

function ProjectCellEditor({
  open,
  onOpenChange,
  consultantId,
  consultantName,
  week,
  projected,
  actual,
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
  projectId: string;
  projectName: string;
  timecode: string;
  onSave?: (projectedHours: number, actualHours: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [projectedHours, setProjectedHours] = useState(projected);
  const [actualHours, setActualHours] = useState(actual);

  const weekDate = parseISO(week);
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isPast = isBefore(weekDate, currentWeekStart);
  const isFuture = isAfter(weekDate, currentWeekStart);

  useEffect(() => {
    if (open) {
      setProjectedHours(projected);
      setActualHours(actual);
      setError(null);
    }
  }, [open, projected, actual]);

  const handleSave = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        if (projectedHours > 0) {
          await updateAllocation(consultantId, week, projectId, projectedHours, AllocationEntryType.PROJECTED);
        } else if (projected > 0) {
          await deleteAllocation(consultantId, projectId, week, AllocationEntryType.PROJECTED);
        }

        if (!isFuture) {
          if (actualHours > 0) {
            await updateAllocation(consultantId, week, projectId, actualHours, AllocationEntryType.ACTUAL);
          } else if (actual > 0) {
            await deleteAllocation(consultantId, projectId, week, AllocationEntryType.ACTUAL);
          }
        }

        onSave?.(projectedHours, actualHours);
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }, [consultantId, week, projectId, projectedHours, actualHours, projected, actual, isFuture, onOpenChange, onSave]);

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
                onChange={(e) => setActualHours(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
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
          projectId={projectId}
          projectName={projectName}
          timecode={timecode}
          onSave={onSave}
        />
      )}
    </>
  );
}
