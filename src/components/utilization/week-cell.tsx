"use client";

import { useState, useMemo } from "react";
import { format, parseISO, startOfWeek, isBefore, isAfter } from "date-fns";
import { AllocationEntryType } from "@prisma/client";
import { cn, getUtilizationColor } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WeekCellEditor } from "./week-cell-editor";
import { ViewMode } from "./grid-filters";

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
  viewMode: ViewMode;
  projects: Array<{ id: string; projectName: string; timecode: string }>;
}

export function WeekCell({
  consultantId,
  consultantName,
  week,
  details,
  standardHours,
  editable,
  viewMode,
  projects,
}: WeekCellProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Determine if this week is in the past, current, or future
  const weekDate = parseISO(week);
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isPast = isBefore(weekDate, currentWeekStart);
  const isFuture = isAfter(weekDate, currentWeekStart);

  // Calculate values based on view mode and time
  const { displayValue, status, tooltipDetails } = useMemo(() => {
    const actualDetails = details.filter(d => d.entryType === AllocationEntryType.ACTUAL);
    const projectedDetails = details.filter(d => d.entryType === AllocationEntryType.PROJECTED);
    
    const actualTotal = actualDetails.reduce((sum, d) => sum + d.hours, 0);
    const projectedTotal = projectedDetails.reduce((sum, d) => sum + d.hours, 0);
    
    let value: number;
    let relevantDetails: AllocationDetail[];
    
    if (viewMode === "actual") {
      // For future weeks, don't show actuals at all
      if (isFuture) {
        value = 0;
        relevantDetails = [];
      } else {
        // For past/current weeks, show actuals (default to projected if no actual)
        value = actualTotal > 0 ? actualTotal : (isPast ? projectedTotal : actualTotal);
        relevantDetails = actualTotal > 0 ? actualDetails : (isPast ? projectedDetails : actualDetails);
      }
    } else if (viewMode === "projected") {
      value = projectedTotal;
      relevantDetails = projectedDetails;
    } else {
      // Difference view: actual - projected (only for past/current)
      if (isFuture) {
        value = 0;
        relevantDetails = [];
      } else {
        const effectiveActual = actualTotal > 0 ? actualTotal : projectedTotal;
        value = effectiveActual - projectedTotal;
        relevantDetails = [...actualDetails, ...projectedDetails];
      }
    }

    // Calculate status based on standard hours
    const ratio = standardHours > 0 ? Math.abs(value) / standardHours : 0;
    let status: "under" | "normal" | "over" = "normal";
    
    if (viewMode === "difference") {
      // For difference, check if significantly off
      if (Math.abs(value) > standardHours * 0.1) {
        status = value > 0 ? "over" : "under";
      }
    } else {
      if (ratio < 0.9) status = "under";
      else if (ratio > 1.1) status = "over";
    }

    return {
      displayValue: value,
      status,
      tooltipDetails: relevantDetails,
    };
  }, [details, viewMode, standardHours, isPast, isFuture]);

  const colorClass = getUtilizationColor(status);
  const utilPercent = standardHours > 0 ? Math.round((Math.abs(displayValue) / standardHours) * 100) : 0;

  // Determine display text
  const displayText = viewMode === "difference" && displayValue !== 0
    ? (displayValue > 0 ? `+${displayValue}` : displayValue.toString())
    : displayValue > 0
    ? displayValue.toString()
    : "-";

  // For future weeks in actual mode, show placeholder
  const showPlaceholder = viewMode === "actual" && isFuture;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "w-16 min-w-16 h-12 border-r flex items-center justify-center text-sm font-medium transition-colors",
              !showPlaceholder && displayValue !== 0 && colorClass,
              editable && "hover:ring-2 hover:ring-primary hover:ring-inset cursor-pointer",
              !editable && "cursor-default",
              showPlaceholder && "bg-muted/20 text-muted-foreground"
            )}
            disabled={!editable}
            onClick={() => editable && setIsEditing(true)}
          >
            {showPlaceholder ? (
              <span className="text-xs text-muted-foreground">N/A</span>
            ) : (
              <span>{displayText}</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium">
              Week of {format(weekDate, "MMM d, yyyy")}
              {isPast && <span className="text-muted-foreground ml-1">(Past)</span>}
              {isFuture && <span className="text-muted-foreground ml-1">(Future)</span>}
            </div>
            {!showPlaceholder && (
              <>
                <div className="text-sm">
                  {viewMode === "difference" ? (
                    `${displayValue > 0 ? "+" : ""}${displayValue} hours variance`
                  ) : (
                    `${Math.abs(displayValue)} / ${standardHours} hours (${utilPercent}%)`
                  )}
                </div>
                {tooltipDetails.length > 0 && (
                  <div className="border-t pt-2 space-y-1">
                    {tooltipDetails.map((detail, idx) => (
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
              </>
            )}
            {showPlaceholder && (
              <div className="text-sm text-muted-foreground">
                Actuals not available for future weeks
              </div>
            )}
            {tooltipDetails.length === 0 && !showPlaceholder && displayValue === 0 && (
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
        />
      )}
    </>
  );
}
