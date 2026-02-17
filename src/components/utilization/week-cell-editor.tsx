"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { format, parseISO, startOfWeek, isBefore, isAfter } from "date-fns";
import { AllocationEntryType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAllocation, deleteAllocation } from "@/app/actions/utilization";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface WeekCellEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantId: string;
  consultantName: string;
  week: string;
  standardHours: number;
  details: AllocationDetail[];
  projects: Array<{ id: string; projectName: string; timecode: string }>;
}

export function WeekCellEditor({
  open,
  onOpenChange,
  consultantId,
  consultantName,
  week,
  standardHours,
  details,
  projects,
}: WeekCellEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  // Local state for editing
  const [editedAllocations, setEditedAllocations] = useState<{
    projectId: string;
    actualHours: number;
    projectedHours: number;
    notes: string;
  }[]>([]);
  
  // New allocation form
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [newActualHours, setNewActualHours] = useState<number>(0);
  const [newProjectedHours, setNewProjectedHours] = useState<number>(8);

  // Determine if this week is in the past, current, or future
  const weekDate = parseISO(week);
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const isPast = isBefore(weekDate, currentWeekStart);
  const isFuture = isAfter(weekDate, currentWeekStart);
  const isCurrent = !isPast && !isFuture;

  // Initialize edited allocations from details
  useEffect(() => {
    if (open) {
      const grouped = new Map<string, {
        projectId: string;
        actualHours: number;
        projectedHours: number;
        notes: string;
      }>();

      details.forEach((d) => {
        if (!grouped.has(d.projectId)) {
          grouped.set(d.projectId, {
            projectId: d.projectId,
            actualHours: 0,
            projectedHours: 0,
            notes: d.notes || "",
          });
        }
        const entry = grouped.get(d.projectId)!;
        if (d.entryType === AllocationEntryType.ACTUAL) {
          entry.actualHours = d.hours;
        } else {
          entry.projectedHours = d.hours;
        }
        if (d.notes && !entry.notes) {
          entry.notes = d.notes;
        }
      });

      setEditedAllocations(Array.from(grouped.values()));
      setError(null);
    }
  }, [open, details]);

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project ? `${project.timecode} - ${project.projectName}` : "Unknown";
  };

  const handleUpdateAllocation = useCallback((index: number, field: 'actualHours' | 'projectedHours' | 'notes', value: number | string) => {
    setEditedAllocations(prev => {
      const updated = [...prev];
      if (field === 'notes') {
        updated[index] = { ...updated[index], notes: value as string };
      } else {
        updated[index] = { ...updated[index], [field]: value as number };
      }
      return updated;
    });
  }, []);

  const handleRemoveAllocation = useCallback((index: number) => {
    setEditedAllocations(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddProject = useCallback(() => {
    if (!newProjectId) return;
    
    // Check if project already exists
    if (editedAllocations.some(a => a.projectId === newProjectId)) {
      setError("This project is already added");
      return;
    }

    setEditedAllocations(prev => [...prev, {
      projectId: newProjectId,
      actualHours: isPast || isCurrent ? newActualHours : 0,
      projectedHours: newProjectedHours,
      notes: "",
    }]);
    
    setNewProjectId("");
    setNewActualHours(0);
    setNewProjectedHours(8);
  }, [newProjectId, newActualHours, newProjectedHours, editedAllocations, isPast, isCurrent]);

  const handleSaveAll = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        // Get existing allocations to determine what to delete
        const existingProjectIds = new Set(details.map(d => d.projectId));
        const newProjectIds = new Set(editedAllocations.map(a => a.projectId));
        
        // Delete allocations for removed projects
        for (const detail of details) {
          if (!newProjectIds.has(detail.projectId)) {
            await deleteAllocation(consultantId, detail.projectId, week, detail.entryType);
          }
        }

        // Update/create allocations
        for (const allocation of editedAllocations) {
          // For past weeks: only update actuals, projected is read-only (but we track it)
          // For future weeks: only update projected, no actuals
          // For current week: update both
          
          if (!isFuture && allocation.actualHours > 0) {
            await updateAllocation(
              consultantId,
              week,
              allocation.projectId,
              allocation.actualHours,
              AllocationEntryType.ACTUAL,
              allocation.notes || undefined
            );
          } else if (!isFuture && allocation.actualHours === 0) {
            // Delete actual if set to 0
            const existingActual = details.find(d => d.projectId === allocation.projectId && d.entryType === AllocationEntryType.ACTUAL);
            if (existingActual) {
              await deleteAllocation(consultantId, allocation.projectId, week, AllocationEntryType.ACTUAL);
            }
          }
          
          if (allocation.projectedHours > 0) {
            await updateAllocation(
              consultantId,
              week,
              allocation.projectId,
              allocation.projectedHours,
              AllocationEntryType.PROJECTED,
              allocation.notes || undefined
            );
          } else if (allocation.projectedHours === 0) {
            // Delete projected if set to 0
            const existingProjected = details.find(d => d.projectId === allocation.projectId && d.entryType === AllocationEntryType.PROJECTED);
            if (existingProjected) {
              await deleteAllocation(consultantId, allocation.projectId, week, AllocationEntryType.PROJECTED);
            }
          }
        }
        
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save allocations");
      }
    });
  }, [consultantId, week, details, editedAllocations, isFuture, onOpenChange]);

  // Calculate totals
  const totalActual = editedAllocations.reduce((sum, a) => sum + a.actualHours, 0);
  const totalProjected = editedAllocations.reduce((sum, a) => sum + a.projectedHours, 0);

  // Get unused projects for the dropdown
  const usedProjectIds = new Set(editedAllocations.map(a => a.projectId));
  const availableProjects = projects.filter(p => !usedProjectIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Allocations - {consultantName}</DialogTitle>
          <DialogDescription>
            Week of {format(weekDate, "MMMM d, yyyy")}
            {isPast && " (Past week - actuals only)"}
            {isFuture && " (Future week - projected only)"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {/* Existing allocations */}
            {editedAllocations.map((allocation, index) => (
              <div key={allocation.projectId} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{getProjectName(allocation.projectId)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAllocation(index)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Actual Hours - only show for past/current weeks */}
                  {!isFuture && (
                    <div className="space-y-1">
                      <Label className="text-xs">Actual Hours</Label>
                      <Input
                        type="number"
                        min="0"
                        max="80"
                        step="0.5"
                        value={allocation.actualHours}
                        onChange={(e) => handleUpdateAllocation(index, 'actualHours', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                  
                  {/* Projected Hours - always show but read-only for past weeks */}
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Projected Hours
                      {isPast && " (read-only)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      value={allocation.projectedHours}
                      onChange={(e) => handleUpdateAllocation(index, 'projectedHours', parseFloat(e.target.value) || 0)}
                      disabled={isPast}
                      className={isPast ? "bg-muted" : ""}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add new project */}
            {availableProjects.length > 0 && (
              <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                <Label className="text-sm font-medium">Add Project</Label>
                <div className="flex gap-2">
                  <Select value={newProjectId} onValueChange={setNewProjectId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.timecode} - {project.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddProject} disabled={!newProjectId}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                
                {newProjectId && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {!isFuture && (
                      <div className="space-y-1">
                        <Label className="text-xs">Actual Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          max="80"
                          step="0.5"
                          value={newActualHours}
                          onChange={(e) => setNewActualHours(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Projected Hours</Label>
                      <Input
                        type="number"
                        min="0"
                        max="80"
                        step="0.5"
                        value={newProjectedHours}
                        onChange={(e) => setNewProjectedHours(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Standard Hours:</span>
            <span className="font-medium">{standardHours}</span>
          </div>
          {!isFuture && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Actual:</span>
              <span className={`font-medium ${totalActual > standardHours ? 'text-red-600' : totalActual < standardHours * 0.9 ? 'text-yellow-600' : 'text-green-600'}`}>
                {totalActual} ({Math.round((totalActual / standardHours) * 100)}%)
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Projected:</span>
            <span className={`font-medium ${totalProjected > standardHours ? 'text-red-600' : totalProjected < standardHours * 0.9 ? 'text-yellow-600' : 'text-green-600'}`}>
              {totalProjected} ({Math.round((totalProjected / standardHours) * 100)}%)
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAll} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save All Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
