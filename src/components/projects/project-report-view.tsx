"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Lock, Save, Trash2, Printer } from "lucide-react";
import {
  type ProjectReportContext,
  type ProjectReportData,
  type Risk,
  type ActionItem,
  createProjectReport,
  updateProjectReport,
  finalizeProjectReport,
} from "@/app/actions/project-reports";

interface ProjectReportViewProps {
  projectContext: ProjectReportContext;
  reports: ProjectReportData[];
}

const healthColors: Record<string, string> = {
  GREEN: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  YELLOW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  RED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

const scheduleColors: Record<string, string> = {
  ON_TRACK: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  AT_RISK: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  BEHIND: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  NOT_SET: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

const scheduleLabels: Record<string, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  BEHIND: "Behind",
  NOT_SET: "No Schedule",
};

const impactColors: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  LOW: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
};

const actionStatusColors: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  BLOCKED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function BudgetTile({ projectContext }: { projectContext: ProjectReportContext }) {
  const { budget, budgetSpent, currency } = projectContext;
  if (!budget) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget</span>
        <span className="text-2xl font-bold">—</span>
        <span className="text-xs text-muted-foreground">No budget set</span>
      </div>
    );
  }
  const pct = Math.min(Math.round((budgetSpent / budget) * 100), 999);
  const remaining = budget - budgetSpent;
  const color = pct >= 100 ? "text-red-600" : pct >= 80 ? "text-yellow-600" : "text-green-600";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget</span>
      <span className={`text-2xl font-bold ${color}`}>{pct}%</span>
      <span className="text-xs text-muted-foreground">
        {formatCurrency(budgetSpent, currency)} spent · {formatCurrency(remaining, currency)} remaining
      </span>
    </div>
  );
}

export function ProjectReportView({ projectContext, reports: initialReports }: ProjectReportViewProps) {
  const [reports, setReports] = useState<ProjectReportData[]>(initialReports);
  const [selectedId, setSelectedId] = useState<string>(initialReports[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = reports.find((r) => r.id === selectedId) ?? null;

  // Local editable state for current report
  const [highlights, setHighlights] = useState(current?.highlights ?? "");
  const [upcomingWork, setUpcomingWork] = useState(current?.upcomingWork ?? "");
  const [risks, setRisks] = useState<Risk[]>(current?.risks ?? []);
  const [actionItems, setActionItems] = useState<ActionItem[]>(current?.actionItems ?? []);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when selected report changes
  const handleSelectReport = (id: string) => {
    setSelectedId(id);
    const r = reports.find((rep) => rep.id === id);
    setHighlights(r?.highlights ?? "");
    setUpcomingWork(r?.upcomingWork ?? "");
    setRisks(r?.risks ?? []);
    setActionItems(r?.actionItems ?? []);
    setIsDirty(false);
    setSaveError(null);
  };

  const markDirty = () => setIsDirty(true);

  const handleSave = () => {
    if (!current || current.isFinalized) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        const updated = await updateProjectReport(current.id, {
          highlights,
          upcomingWork,
          risks,
          actionItems,
        });
        setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setIsDirty(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const handleFinalize = () => {
    if (!current) return;
    startTransition(async () => {
      try {
        const updated = await finalizeProjectReport(current.id);
        setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setShowFinalizeConfirm(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Finalize failed");
      }
    });
  };

  const handleCreateReport = () => {
    if (!newStart || !newEnd) return;
    startTransition(async () => {
      try {
        const newest = reports[0]; // most recent (desc order)
        const created = await createProjectReport(projectContext.id, {
          periodStart: newStart,
          periodEnd: newEnd,
          copyFromReportId: newest?.id,
        });
        setReports((prev) => [created, ...prev]);
        handleSelectReport(created.id);
        setShowNewDialog(false);
        setNewStart("");
        setNewEnd("");
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Create failed");
      }
    });
  };

  // Risk helpers
  const addRisk = () => {
    setRisks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", impact: "MEDIUM", mitigation: "", owner: "" },
    ]);
    markDirty();
  };
  const updateRisk = (id: string, field: keyof Risk, value: string) => {
    setRisks((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    markDirty();
  };
  const removeRisk = (id: string) => {
    setRisks((prev) => prev.filter((r) => r.id !== id));
    markDirty();
  };

  // Action item helpers
  const addActionItem = () => {
    setActionItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", owner: "", dueDate: "", status: "OPEN" },
    ]);
    markDirty();
  };
  const updateActionItem = (id: string, field: keyof ActionItem, value: string) => {
    setActionItems((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
    markDirty();
  };
  const removeActionItem = (id: string) => {
    setActionItems((prev) => prev.filter((a) => a.id !== id));
    markDirty();
  };

  const isFinalized = current?.isFinalized ?? false;

  return (
    <>
      <style>{`
        @media print {
          aside,
          header { display: none !important; }
          main { padding: 0 !important; background: white !important; }
          .print\\:hidden { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Weekly Status Report
          </div>
          <h1 className="text-2xl font-bold">{projectContext.projectName}</h1>
          <p className="text-sm text-muted-foreground">
            {projectContext.client}
            {projectContext.projectManager && ` · PM: ${projectContext.projectManager.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {reports.length > 0 && (
            <Select value={selectedId} onValueChange={handleSelectReport}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select report" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    #{r.reportNumber} ·{" "}
                    {format(new Date(r.periodStart), "MMM d")}–
                    {format(new Date(r.periodEnd), "MMM d, yyyy")}
                    {r.isFinalized ? " 🔒" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Report
          </Button>
          {current && !isFinalized && isDirty && (
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              <Save className="h-4 w-4 mr-1" />
              {isPending ? "Saving…" : "Save"}
            </Button>
          )}
          {current && !isFinalized && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFinalizeConfirm(true)}
              disabled={isPending || isDirty}
            >
              <Lock className="h-4 w-4 mr-1" />
              Finalize
            </Button>
          )}
          {current && isFinalized && (
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Print / PDF
            </Button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md print:hidden">
          {saveError}
        </div>
      )}

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No reports yet. Click &ldquo;New Report&rdquo; to create the first one.
          </CardContent>
        </Card>
      ) : current ? (
        <>
          {isFinalized && (
            <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-md text-sm font-medium">
              <Lock className="h-4 w-4" />
              Report finalized
              {current.finalizedAt &&
                ` · ${format(new Date(current.finalizedAt), "MMM d, yyyy 'at' h:mm a")}`}
            </div>
          )}

          {/* Report period */}
          <p className="text-sm text-muted-foreground">
            Report #{current.reportNumber} · Period:{" "}
            {format(new Date(current.periodStart), "MMM d")}–
            {format(new Date(current.periodEnd), "MMM d, yyyy")}
          </p>

          {/* Status tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Project Health */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Project Health
                  </span>
                  {projectContext.healthStatus ? (
                    <Badge
                      variant="secondary"
                      className={healthColors[projectContext.healthStatus]}
                    >
                      {projectContext.healthStatus}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not set</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Schedule
                  </span>
                  <Badge
                    variant="secondary"
                    className={scheduleColors[projectContext.scheduleStatus]}
                  >
                    {scheduleLabels[projectContext.scheduleStatus]}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Budget */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <BudgetTile projectContext={projectContext} />
              </CardContent>
            </Card>

            {/* Overall Progress */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Overall Progress
                  </span>
                  <span className="text-2xl font-bold">
                    {projectContext.overallProgress}%
                  </span>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${projectContext.overallProgress}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Highlights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Key Highlights / Accomplishments</CardTitle>
            </CardHeader>
            <CardContent>
              {isFinalized ? (
                <div className="whitespace-pre-wrap text-sm">
                  {highlights || <span className="text-muted-foreground">None recorded.</span>}
                </div>
              ) : (
                <Textarea
                  placeholder="Enter key accomplishments this period (one per line)…"
                  rows={5}
                  value={highlights}
                  onChange={(e) => {
                    setHighlights(e.target.value);
                    markDirty();
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Upcoming Work */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Work</CardTitle>
            </CardHeader>
            <CardContent>
              {isFinalized ? (
                <div className="whitespace-pre-wrap text-sm">
                  {upcomingWork || <span className="text-muted-foreground">None recorded.</span>}
                </div>
              ) : (
                <Textarea
                  placeholder="Enter planned work for the next period (one per line)…"
                  rows={5}
                  value={upcomingWork}
                  onChange={(e) => {
                    setUpcomingWork(e.target.value);
                    markDirty();
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Risks */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Risks</CardTitle>
              {!isFinalized && (
                <Button variant="outline" size="sm" onClick={addRisk}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Risk
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {risks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No risks recorded.</p>
              ) : (
                <div className="space-y-3">
                  {isFinalized ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground w-[40%]">Description</th>
                          <th className="text-left py-2 font-medium text-muted-foreground w-[10%]">Impact</th>
                          <th className="text-left py-2 font-medium text-muted-foreground w-[30%]">Mitigation</th>
                          <th className="text-left py-2 font-medium text-muted-foreground w-[20%]">Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {risks.map((risk) => (
                          <tr key={risk.id} className="border-b last:border-0">
                            <td className="py-2">{risk.description}</td>
                            <td className="py-2">
                              <Badge variant="secondary" className={impactColors[risk.impact]}>
                                {risk.impact}
                              </Badge>
                            </td>
                            <td className="py-2 text-muted-foreground">{risk.mitigation}</td>
                            <td className="py-2 text-muted-foreground">{risk.owner}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    risks.map((risk) => (
                      <div key={risk.id} className="grid grid-cols-[1fr_120px_1fr_140px_32px] gap-2 items-start">
                        <Input
                          placeholder="Description"
                          value={risk.description}
                          onChange={(e) => updateRisk(risk.id, "description", e.target.value)}
                        />
                        <Select
                          value={risk.impact}
                          onValueChange={(v) => updateRisk(risk.id, "impact", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="LOW">Low</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Mitigation"
                          value={risk.mitigation}
                          onChange={(e) => updateRisk(risk.id, "mitigation", e.target.value)}
                        />
                        <Input
                          placeholder="Owner"
                          value={risk.owner}
                          onChange={(e) => updateRisk(risk.id, "owner", e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeRisk(risk.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Items */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Action Items</CardTitle>
              {!isFinalized && (
                <Button variant="outline" size="sm" onClick={addActionItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No action items recorded.</p>
              ) : (
                <div className="space-y-3">
                  {isFinalized ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground w-[40%]">Description</th>
                          <th className="text-left py-2 font-medium text-muted-foreground w-[20%]">Owner</th>
                          <th className="text-left py-2 font-medium text-muted-foreground w-[20%]">Due Date</th>
                          <th className="text-left py-2 font-medium text-muted-foreground w-[20%]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionItems.map((ai) => (
                          <tr key={ai.id} className="border-b last:border-0">
                            <td className="py-2">{ai.description}</td>
                            <td className="py-2 text-muted-foreground">{ai.owner}</td>
                            <td className="py-2 text-muted-foreground">
                              {ai.dueDate
                                ? format(parseISO(ai.dueDate), "MMM d, yyyy")
                                : "—"}
                            </td>
                            <td className="py-2">
                              <Badge variant="secondary" className={actionStatusColors[ai.status]}>
                                {ai.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    actionItems.map((ai) => (
                      <div key={ai.id} className="grid grid-cols-[1fr_140px_140px_130px_32px] gap-2 items-start">
                        <Input
                          placeholder="Description"
                          value={ai.description}
                          onChange={(e) => updateActionItem(ai.id, "description", e.target.value)}
                        />
                        <Input
                          placeholder="Owner"
                          value={ai.owner}
                          onChange={(e) => updateActionItem(ai.id, "owner", e.target.value)}
                        />
                        <Input
                          type="date"
                          value={ai.dueDate}
                          onChange={(e) => updateActionItem(ai.id, "dueDate", e.target.value)}
                        />
                        <Select
                          value={ai.status}
                          onValueChange={(v) => updateActionItem(ai.id, "status", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="DONE">Done</SelectItem>
                            <SelectItem value="BLOCKED">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeActionItem(ai.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* New Report Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Status Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Period Start</label>
              <Input
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Period End</label>
              <Input
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
            {reports.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Content (highlights, upcoming work, open action items) will be copied from the most recent report.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateReport}
              disabled={!newStart || !newEnd || isPending}
            >
              Create Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Confirm */}
      <AlertDialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize Report</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock the report and prevent further edits. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleFinalize} disabled={isPending}>
              {isPending ? "Finalizing…" : "Finalize"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}
