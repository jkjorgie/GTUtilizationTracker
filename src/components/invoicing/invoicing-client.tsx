"use client";

import { useState, useCallback, useTransition } from "react";
import {
  getInvoicingData,
  upsertInvoicePeriod,
  updateProjectInvoiceComments,
  createOtherInvoice,
  updateOtherInvoice,
  deleteOtherInvoice,
  type InvoicingData,
  type InvoicePeriodData,
  type OtherInvoiceData,
} from "@/app/actions/invoicing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from "lucide-react";
import { OtherInvoiceStatus } from "@prisma/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  client: string;
  projectName: string;
  timecode: string;
};

interface InvoicingClientProps {
  projects: Project[];
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(isoString: string | null) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateInput(isoString: string | null) {
  if (!isoString) return "";
  return isoString.slice(0, 10);
}

function StatusBadge({ status }: { status: "projected" | "reported" | "invoiced" }) {
  const variants = {
    projected: "secondary",
    reported: "outline",
    invoiced: "default",
  } as const;
  const labels = { projected: "Projected", reported: "Reported", invoiced: "Invoiced" };
  return (
    <Badge
      variant={variants[status]}
      className={cn(
        status === "reported" && "border-blue-500 text-blue-600",
        status === "invoiced" && "bg-green-600 text-white"
      )}
    >
      {labels[status]}
    </Badge>
  );
}

// Inline editable field with save-on-blur
function InlineField({
  value,
  onSave,
  type = "text",
  placeholder,
  className,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: "text" | "date";
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (!editing) {
    return (
      <span
        className={cn(
          "cursor-pointer hover:bg-muted rounded px-1 py-0.5 min-w-[80px] inline-block text-sm",
          !local && "text-muted-foreground italic",
          className
        )}
        onClick={() => {
          setLocal(value);
          setEditing(true);
        }}
      >
        {type === "date" && local ? formatDate(local + "T00:00:00Z") : local || placeholder || "Click to edit"}
      </span>
    );
  }

  return (
    <Input
      type={type}
      value={local}
      autoFocus
      className="h-7 text-sm w-36"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onSave(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          onSave(local);
        }
        if (e.key === "Escape") {
          setEditing(false);
          setLocal(value);
        }
      }}
    />
  );
}

// Expandable invoice period row
function PeriodRow({
  period,
  isBillable,
  projectId,
  currency,
  onSaved,
}: {
  period: InvoicePeriodData;
  isBillable: boolean;
  projectId: string;
  currency: string;
  onSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = useCallback(
    (patch: {
      invoiceNumber?: string | null;
      invoiceDate?: string | null;
      comments?: string | null;
    }) => {
      startTransition(async () => {
        try {
          await upsertInvoicePeriod({
            projectId,
            periodStart: period.periodStart,
            isBillable,
            invoiceNumber: patch.invoiceNumber !== undefined ? patch.invoiceNumber : period.invoiceNumber,
            invoiceDate: patch.invoiceDate !== undefined ? patch.invoiceDate : period.invoiceDate ? formatDateInput(period.invoiceDate) : null,
            comments: patch.comments !== undefined ? patch.comments : period.comments,
          });
          onSaved();
        } catch {
          toast.error("Failed to save");
        }
      });
    },
    [projectId, period, isBillable, onSaved]
  );

  return (
    <>
      <TableRow className={cn(isPending && "opacity-60")}>
        <TableCell className="w-8">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-sm">{formatDate(period.periodStart)}</TableCell>
        <TableCell className="font-mono text-sm">{formatDate(period.periodEnd)}</TableCell>
        <TableCell>
          <StatusBadge status={period.status} />
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(period.msrpTotal, currency)}
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(period.discountedTotal, currency)}
        </TableCell>
        {isBillable && (
          <>
            <TableCell>
              <InlineField
                value={period.invoiceNumber ?? ""}
                placeholder="Enter #"
                onSave={(v) => save({ invoiceNumber: v || null })}
              />
            </TableCell>
            <TableCell>
              <InlineField
                value={formatDateInput(period.invoiceDate)}
                type="date"
                onSave={(v) => save({ invoiceDate: v || null })}
              />
            </TableCell>
          </>
        )}
        <TableCell>
          <InlineField
            value={period.comments ?? ""}
            placeholder="Add note"
            onSave={(v) => save({ comments: v || null })}
            className="max-w-[200px]"
          />
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={isBillable ? 9 : 7} className="p-0">
            <div className="px-8 py-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Week Of</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {period.rows.map((row) => (
                    <TableRow key={`${row.consultantId}_${row.weekStart}`}>
                      <TableCell className="font-medium">{row.consultantName}</TableCell>
                      <TableCell className="text-right font-mono">{row.hours}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(row.weekStart)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.entryType === "ACTUAL" ? "default" : "secondary"} className="text-xs">
                          {row.entryType === "ACTUAL" ? "Actual" : "Projected"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// Other invoices section
function OtherInvoicesSection({
  projectId,
  invoices,
  currency,
  onSaved,
}: {
  projectId: string;
  invoices: OtherInvoiceData[];
  currency: string;
  onSaved: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: "",
    invoiceNumber: "",
    description: "",
    amount: "",
    status: OtherInvoiceStatus.EXPECTED as OtherInvoiceStatus,
    invoiceDate: "",
  });
  const [isPending, startTransition] = useTransition();

  function openNew() {
    setEditingId(null);
    setForm({ date: "", invoiceNumber: "", description: "", amount: "", status: OtherInvoiceStatus.EXPECTED, invoiceDate: "" });
    setDialogOpen(true);
  }

  function openEdit(inv: OtherInvoiceData) {
    setEditingId(inv.id);
    setForm({
      date: formatDateInput(inv.date),
      invoiceNumber: inv.invoiceNumber ?? "",
      description: inv.description ?? "",
      amount: inv.amount.toString(),
      status: inv.status,
      invoiceDate: inv.invoiceDate ? formatDateInput(inv.invoiceDate) : "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.date) {
      toast.error("Date is required");
      return;
    }
    const amount = parseFloat(form.amount) || 0;
    startTransition(async () => {
      try {
        if (editingId) {
          await updateOtherInvoice(editingId, {
            date: form.date,
            invoiceNumber: form.invoiceNumber || null,
            description: form.description || null,
            amount,
            status: form.status,
            invoiceDate: form.invoiceDate || null,
          });
        } else {
          await createOtherInvoice({
            projectId,
            date: form.date,
            invoiceNumber: form.invoiceNumber || null,
            description: form.description || null,
            amount,
            status: form.status,
            invoiceDate: form.invoiceDate || null,
          });
        }
        toast.success(editingId ? "Invoice updated" : "Invoice added");
        setDialogOpen(false);
        onSaved();
      } catch {
        toast.error("Failed to save invoice");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteOtherInvoice(id);
        toast.success("Invoice deleted");
        onSaved();
      } catch {
        toast.error("Failed to delete invoice");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Other Invoices</h3>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          Add Invoice
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expected Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No other invoices yet.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id} className={isPending ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        inv.status === OtherInvoiceStatus.INVOICED
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                          : inv.status === OtherInvoiceStatus.REQUESTED
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                      }
                    >
                      {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {inv.invoiceDate ? formatDate(inv.invoiceDate) : "—"}
                  </TableCell>
                  <TableCell>{inv.invoiceNumber ?? "—"}</TableCell>
                  <TableCell>{inv.description ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(inv.amount, currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(inv)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(inv.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Invoice" : "Add Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Expected Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as OtherInvoiceStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OtherInvoiceStatus.EXPECTED}>Expected</SelectItem>
                    <SelectItem value={OtherInvoiceStatus.REQUESTED}>Requested</SelectItem>
                    <SelectItem value={OtherInvoiceStatus.INVOICED}>Invoiced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice #</Label>
                <Input
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  placeholder="e.g. INV-001"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Invoice periods grid (billable or non-billable)
function InvoicePeriodsGrid({
  title,
  periods,
  isBillable,
  projectId,
  currency,
  onSaved,
}: {
  title: string;
  periods: InvoicePeriodData[];
  isBillable: boolean;
  projectId: string;
  currency: string;
  onSaved: () => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">MSRP Total</TableHead>
              <TableHead className="text-right">Discounted Total</TableHead>
              {isBillable && (
                <>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                </>
              )}
              <TableHead>Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isBillable ? 9 : 7} className="text-center text-muted-foreground py-6">
                  No billing periods found for this project.
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period) => (
                <PeriodRow
                  key={period.periodStart}
                  period={period}
                  isBillable={isBillable}
                  projectId={projectId}
                  currency={currency}
                  onSaved={onSaved}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function InvoicingClient({ projects }: InvoicingClientProps) {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [data, setData] = useState<InvoicingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState("");
  const [savingComments, setSavingComments] = useState(false);

  const clients = Array.from(new Set(projects.map((p) => p.client))).sort();
  const clientProjects = projects.filter((p) => p.client === selectedClient);

  const loadData = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setLoading(true);
    try {
      const result = await getInvoicingData(projectId);
      setData(result);
      setComments(result.project.comments ?? "");
    } catch {
      toast.error("Failed to load invoicing data");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleClientChange(client: string) {
    setSelectedClient(client);
    setSelectedProjectId("");
    setData(null);
  }

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setData(null);
    await loadData(projectId);
  }

  async function handleSaveComments() {
    if (!data) return;
    setSavingComments(true);
    try {
      await updateProjectInvoiceComments(data.project.id, comments);
      toast.success("Comments saved");
    } catch {
      toast.error("Failed to save comments");
    } finally {
      setSavingComments(false);
    }
  }

  const currency = data?.project.currency ?? "USD";
  const totals = data?.headerTotals;

  return (
    <div className="space-y-6">
      {/* Client → Project Selectors */}
      <div className="flex gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Client</label>
          <Select value={selectedClient} onValueChange={handleClientChange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Project</label>
          <Select
            value={selectedProjectId}
            onValueChange={handleProjectChange}
            disabled={!selectedClient}
          >
            <SelectTrigger className="w-80">
              <SelectValue placeholder={selectedClient ? "Select a project..." : "Select a client first"} />
            </SelectTrigger>
            <SelectContent>
              {clientProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.projectName} ({p.timecode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <div className="text-center text-muted-foreground py-12">Loading invoicing data...</div>
      )}

      {!loading && data && (
        <div className="space-y-8">
          {/* Header Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {totals?.totalBudget != null
                    ? formatCurrency(totals.totalBudget, currency)
                    : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  {formatCurrency(totals?.totalUsed ?? 0, currency)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Projected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-amber-600">
                  {formatCurrency(totals?.totalProjected ?? 0, currency)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold font-mono",
                    totals?.totalRemaining != null && totals.totalRemaining < 0
                      ? "text-destructive"
                      : "text-green-600"
                  )}
                >
                  {totals?.totalRemaining != null
                    ? formatCurrency(totals.totalRemaining, currency)
                    : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Leave important billing or project notes here..."
                rows={3}
                className="resize-none"
              />
              <Button
                size="sm"
                onClick={handleSaveComments}
                disabled={savingComments}
              >
                {savingComments ? "Saving..." : "Save Notes"}
              </Button>
            </CardContent>
          </Card>

          {/* Billable Consultants Grid */}
          <InvoicePeriodsGrid
            title="Billable Consultant Invoices"
            periods={data.billablePeriods}
            isBillable={true}
            projectId={data.project.id}
            currency={currency}
            onSaved={() => loadData(data.project.id)}
          />

          {/* Non-Billable Consultants Grid */}
          <InvoicePeriodsGrid
            title="Non-Billable Consultant Time"
            periods={data.nonBillablePeriods}
            isBillable={false}
            projectId={data.project.id}
            currency={currency}
            onSaved={() => loadData(data.project.id)}
          />

          {/* Other Invoices */}
          <OtherInvoicesSection
            projectId={data.project.id}
            invoices={data.otherInvoices}
            currency={currency}
            onSaved={() => loadData(data.project.id)}
          />
        </div>
      )}

      {!loading && !data && selectedProjectId && (
        <div className="text-center text-muted-foreground py-12">
          No data found for this project.
        </div>
      )}
    </div>
  );
}
