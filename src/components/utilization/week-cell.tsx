"use client";

import { useState, useCallback, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { AllocationEntryType } from "@prisma/client";
import { cn, getUtilizationColor } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAllocation } from "@/app/actions/utilization";
import { Loader2, Plus } from "lucide-react";
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
  week: string;
  value: number;
  details: AllocationDetail[];
  status: "under" | "normal" | "over";
  standardHours: number;
  editable: boolean;
  viewMode: ViewMode;
  projects: Array<{ id: string; projectName: string; timecode: string }>;
}

export function WeekCell({
  consultantId,
  week,
  value,
  details,
  status,
  standardHours,
  editable,
  viewMode,
  projects,
}: WeekCellProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string>("");
  const [editHours, setEditHours] = useState<number>(8);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    if (!editProjectId || editHours <= 0) return;

    setError(null);
    startTransition(async () => {
      try {
        await updateAllocation(
          consultantId,
          week,
          editProjectId,
          editHours,
          viewMode === "projected" ? AllocationEntryType.PROJECTED : AllocationEntryType.ACTUAL
        );
        setIsEditing(false);
        setEditProjectId("");
        setEditHours(8);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }, [consultantId, week, editProjectId, editHours, viewMode]);

  const colorClass = getUtilizationColor(status);
  const utilPercent = standardHours > 0 ? Math.round((value / standardHours) * 100) : 0;

  // Filter details by current view mode
  const relevantDetails = details.filter((d) => {
    if (viewMode === "actual") return d.entryType === AllocationEntryType.ACTUAL;
    if (viewMode === "projected") return d.entryType === AllocationEntryType.PROJECTED;
    return true;
  });

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "w-16 min-w-16 h-12 border-r flex items-center justify-center text-sm font-medium transition-colors",
                value > 0 && colorClass,
                editable && "hover:ring-2 hover:ring-primary hover:ring-inset cursor-pointer",
                !editable && "cursor-default"
              )}
              disabled={!editable}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : value > 0 ? (
                <span>{value}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium">
              Week of {format(parseISO(week), "MMM d, yyyy")}
            </div>
            <div className="text-sm">
              {value} / {standardHours} hours ({utilPercent}%)
            </div>
            {relevantDetails.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                {relevantDetails.map((detail, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{detail.timecode}</span>: {detail.hours}h
                    {detail.notes && (
                      <span className="text-muted-foreground"> - {detail.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {relevantDetails.length === 0 && value === 0 && (
              <div className="text-sm text-muted-foreground">No allocations</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {editable && (
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Add Allocation</h4>
              <p className="text-sm text-muted-foreground">
                Week of {format(parseISO(week), "MMM d, yyyy")}
              </p>
            </div>

            {error && (
              <div className="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded">
                {error}
              </div>
            )}

            {/* Existing allocations */}
            {relevantDetails.length > 0 && (
              <div className="space-y-2 pb-2 border-b">
                <Label className="text-xs text-muted-foreground">Current Allocations</Label>
                {relevantDetails.map((detail, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{detail.timecode}</span>
                    <span className="font-medium">{detail.hours}h</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={editProjectId} onValueChange={setEditProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.timecode} - {project.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  min="0.5"
                  max="80"
                  step="0.5"
                  value={editHours}
                  onChange={(e) => setEditHours(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!editProjectId || editHours <= 0 || isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
