"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ScheduleItemType } from "@prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Diamond } from "lucide-react";
import {
  type ScheduleItemData,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from "@/app/actions/project-schedule";

type Project = {
  id: string;
  client: string;
  projectName: string;
  startDate: Date | null;
  endDate: Date | null;
  projectManager: { name: string } | null;
};

interface ProjectScheduleViewProps {
  project: Project;
  scheduleItems: ScheduleItemData[];
}

type FormData = {
  type: ScheduleItemType;
  name: string;
  owner: string;
  startDate: string;
  endDate: string;
  percentComplete: number;
  parentId: string;
};

const emptyForm = (): FormData => ({
  type: ScheduleItemType.TASK,
  name: "",
  owner: "",
  startDate: "",
  endDate: "",
  percentComplete: 0,
  parentId: "",
});

function getStatusBadge(item: ScheduleItemData) {
  if (item.type === ScheduleItemType.MILESTONE) {
    if (!item.endDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(item.endDate);
    if (item.percentComplete >= 100) return { label: "Done", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" };
    if (today > due) return { label: "Overdue", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" };
    return { label: "Upcoming", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" };
  }

  if (item.percentComplete >= 100) return { label: "Done", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" };
  if (!item.endDate) return { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(item.endDate);
  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);

  if (daysOverdue > 7) return { label: "Behind", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" };
  if (daysOverdue > 0) return { label: "At Risk", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" };
  return { label: "On Track", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" };
}

function ScheduleRow({
  item,
  isChild,
  onEdit,
  onDelete,
  onAddMilestone,
}: {
  item: ScheduleItemData;
  isChild: boolean;
  onEdit: (item: ScheduleItemData) => void;
  onDelete: (item: ScheduleItemData) => void;
  onAddMilestone: (parentId: string) => void;
}) {
  const status = getStatusBadge(item);
  const isMilestone = item.type === ScheduleItemType.MILESTONE;

  return (
    <>
      <tr className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${isChild ? "bg-muted/20" : ""}`}>
        <td className="py-3 px-3">
          <div className={`flex items-center gap-2 ${isChild ? "pl-6" : ""}`}>
            {isMilestone ? (
              <Diamond className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span className={`text-sm ${isMilestone ? "text-purple-700 dark:text-purple-300" : "font-medium"}`}>
              {item.name}
            </span>
          </div>
        </td>
        <td className="py-3 px-3 text-sm text-muted-foreground">
          {item.owner || "—"}
        </td>
        <td className="py-3 px-3 text-sm text-muted-foreground">
          {item.startDate ? format(new Date(item.startDate), "MMM d, yyyy") : "—"}
        </td>
        <td className="py-3 px-3 text-sm text-muted-foreground">
          {item.endDate ? format(new Date(item.endDate), "MMM d, yyyy") : "—"}
        </td>
        <td className="py-3 px-3">
          {!isMilestone && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden w-16">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${item.percentComplete}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-7 text-right">{item.percentComplete}%</span>
            </div>
          )}
        </td>
        <td className="py-3 px-3">
          {status && (
            <Badge variant="secondary" className={`text-xs ${status.color}`}>
              {status.label}
            </Badge>
          )}
        </td>
        <td className="py-3 px-3">
          <div className="flex items-center gap-1">
            {!isMilestone && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onAddMilestone(item.id)}
              >
                + Milestone
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {item.children.map((child) => (
        <ScheduleRow
          key={child.id}
          item={child}
          isChild
          onEdit={onEdit}
          onDelete={onDelete}
          onAddMilestone={onAddMilestone}
        />
      ))}
    </>
  );
}

export function ProjectScheduleView({ project, scheduleItems: initialItems }: ProjectScheduleViewProps) {
  const [items, setItems] = useState<ScheduleItemData[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItemData | null>(null);
  const [deletingItem, setDeletingItem] = useState<ScheduleItemData | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const openAdd = (parentId?: string) => {
    setEditingItem(null);
    setForm({
      ...emptyForm(),
      type: parentId ? ScheduleItemType.MILESTONE : ScheduleItemType.TASK,
      parentId: parentId ?? "",
    });
    setError(null);
    setShowDialog(true);
  };

  const openEdit = (item: ScheduleItemData) => {
    setEditingItem(item);
    setForm({
      type: item.type,
      name: item.name,
      owner: item.owner ?? "",
      startDate: item.startDate ? format(new Date(item.startDate), "yyyy-MM-dd") : "",
      endDate: item.endDate ? format(new Date(item.endDate), "yyyy-MM-dd") : "",
      percentComplete: item.percentComplete,
      parentId: item.parentId ?? "",
    });
    setError(null);
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        if (editingItem) {
          await updateScheduleItem(editingItem.id, {
            name: form.name,
            owner: form.owner,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            percentComplete: form.percentComplete,
          });
        } else {
          await createScheduleItem(project.id, {
            type: form.type,
            name: form.name,
            owner: form.owner,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
            percentComplete: form.percentComplete,
            parentId: form.parentId || undefined,
          });
        }
        // Reload from server by refreshing - use router.refresh() pattern
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const handleDelete = () => {
    if (!deletingItem) return;
    startTransition(async () => {
      try {
        await deleteScheduleItem(deletingItem.id);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const hasItems = items.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Project Schedule
          </div>
          <h1 className="text-2xl font-bold">{project.projectName}</h1>
          <p className="text-sm text-muted-foreground">
            {project.client}
            {project.projectManager && ` · PM: ${project.projectManager.name}`}
            {project.startDate && project.endDate && (
              <> · {format(new Date(project.startDate), "MMM d, yyyy")} – {format(new Date(project.endDate), "MMM d, yyyy")}</>
            )}
          </p>
        </div>
        <Button onClick={() => openAdd()}>
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      {error && !showDialog && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tasks &amp; Milestones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!hasItems ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No tasks yet. Click &ldquo;Add Task&rdquo; to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[28%]">
                      Phase / Task
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[14%]">
                      Owner
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[12%]">
                      Start
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[12%]">
                      End
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[14%]">
                      Progress
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[10%]">
                      Status
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-[10%]">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <ScheduleRow
                      key={item.id}
                      item={item}
                      isChild={false}
                      onEdit={openEdit}
                      onDelete={setDeletingItem}
                      onAddMilestone={openAdd}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !isPending && setShowDialog(open)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit ${editingItem.type === ScheduleItemType.MILESTONE ? "Milestone" : "Task"}` : `Add ${form.type === ScheduleItemType.MILESTONE ? "Milestone" : "Task"}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editingItem && !form.parentId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as ScheduleItemType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ScheduleItemType.TASK}>Task / Phase</SelectItem>
                    <SelectItem value={ScheduleItemType.MILESTONE}>Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Enter name…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Owner</label>
              <Input
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                placeholder="Responsible person…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {form.type === ScheduleItemType.MILESTONE ? "Due Date" : "End Date"}
                </label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            {form.type === ScheduleItemType.TASK && (
              <div className="space-y-2">
                <label className="text-sm font-medium">% Complete</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.percentComplete}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, percentComplete: Number(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-10 text-right">{form.percentComplete}%</span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : editingItem ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingItem?.type === ScheduleItemType.MILESTONE ? "Milestone" : "Task"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingItem?.name}&rdquo;?
              {deletingItem?.type === ScheduleItemType.TASK && deletingItem.children.length > 0 && (
                <> This will also delete {deletingItem.children.length} milestone(s) under it.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
