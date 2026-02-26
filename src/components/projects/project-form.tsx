"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProjectType, ProjectStatus, SalesManager, Currency, ContractType, HealthStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { createProject, updateProject } from "@/app/actions/projects";
import { upsertProjectMember, removeProjectMember, seedMemberAllocations } from "@/app/actions/project-members";
import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

const formSchema = z.object({
  client: z.string().min(1, "Client is required"),
  projectName: z.string().min(1, "Project name is required"),
  timecode: z.string().min(1, "Timecode is required"),
  type: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
  projectManagerId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  salesManager: z.nativeEnum(SalesManager).optional().nullable(),
  // Stored as strings in the form; converted to numbers in onSubmit
  budget: z.string().optional().nullable(),
  currency: z.nativeEnum(Currency),
  contractType: z.nativeEnum(ContractType).optional().nullable(),
  healthStatus: z.nativeEnum(HealthStatus).optional().nullable(),
  salesDiscount: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

export type ProjectMemberRow = {
  consultantId: string;
  consultantName: string;
  memberId: string | null;
  roleDefinitionId: string | null;
  roleDefinitionName: string | null;
  msrpRate: number | null;
  billingRate: number | null;
  fromAllocation: boolean;
};

export interface ProjectWithRelations {
  id: string;
  client: string;
  projectName: string;
  timecode: string;
  type: ProjectType;
  status: ProjectStatus;
  projectManagerId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  salesManager?: SalesManager | null;
  budget?: number | null;
  currency?: Currency;
  contractType?: ContractType | null;
  healthStatus?: HealthStatus | null;
  salesDiscount?: number | null;
  comments?: string | null;
  projectManager?: { id: string; name: string } | null;
  members?: ProjectMemberRow[];
}

interface ProjectFormProps {
  project?: ProjectWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pemConsultants: { id: string; name: string }[];
  roleDefinitions: { id: string; name: string; msrpRate: number; category: string }[];
  allConsultants: { id: string; name: string; billingRoleIds: string[] }[];
}

const salesManagerLabels: Record<SalesManager, string> = {
  SCOTT_A: "Scott A.",
  RAIN: "Rain",
  JOHN_B: "John B.",
  TODD: "Todd",
};

const healthColors: Record<HealthStatus, string> = {
  RED: "bg-red-500",
  YELLOW: "bg-yellow-400",
  GREEN: "bg-green-500",
};

const healthLabels: Record<HealthStatus, string> = {
  RED: "Red",
  YELLOW: "Yellow",
  GREEN: "Green",
};

function getCurrentWeekSunday(): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ProjectForm({
  project,
  open,
  onOpenChange,
  pemConsultants,
  roleDefinitions,
  allConsultants,
}: ProjectFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // Tracks the saved project (set after first save when creating new)
  const [currentProject, setCurrentProject] = useState<ProjectWithRelations | null>(project ?? null);
  // Controls whether the modal closes after submit
  const closeAfterSave = useRef(false);

  // Team tab state
  const [members, setMembers] = useState<ProjectMemberRow[]>(project?.members ?? []);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberConsultantId, setNewMemberConsultantId] = useState("");
  const [newMemberRoleId, setNewMemberRoleId] = useState("");
  const [newMemberRate, setNewMemberRate] = useState("");
  const [newMemberWeeklyHours, setNewMemberWeeklyHours] = useState("");
  const [newMemberFromDate, setNewMemberFromDate] = useState("");
  const [newMemberToDate, setNewMemberToDate] = useState("");
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRoleId, setEditRoleId] = useState("");
  const [editRate, setEditRate] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client: "",
      projectName: "",
      timecode: "",
      type: ProjectType.BILLABLE,
      status: ProjectStatus.ACTIVE,
      projectManagerId: null,
      startDate: null,
      endDate: null,
      salesManager: null,
      budget: "",
      currency: Currency.USD,
      contractType: null,
      healthStatus: null,
      salesDiscount: "",
      comments: null,
    },
  });

  useEffect(() => {
    if (open) {
      setCurrentProject(project ?? null);
      form.reset({
        client: project?.client ?? "",
        projectName: project?.projectName ?? "",
        timecode: project?.timecode ?? "",
        type: project?.type ?? ProjectType.BILLABLE,
        status: project?.status ?? ProjectStatus.ACTIVE,
        projectManagerId: project?.projectManagerId ?? null,
        startDate: toDateInput(project?.startDate) || null,
        endDate: toDateInput(project?.endDate) || null,
        salesManager: project?.salesManager ?? null,
        budget: project?.budget != null ? String(project.budget) : "",
        currency: project?.currency ?? Currency.USD,
        contractType: project?.contractType ?? null,
        healthStatus: project?.healthStatus ?? null,
        salesDiscount: project?.salesDiscount != null ? String(project.salesDiscount) : "",
        comments: project?.comments ?? null,
      });
      setMembers(project?.members ?? []);
      setError(null);
      setActiveTab("basic");
      setAddingMember(false);
      setEditingMemberId(null);
      setNewMemberWeeklyHours("");
      setNewMemberFromDate("");
      setNewMemberToDate("");
    }
  }, [project, open, form]);

  const handleNewRoleChange = useCallback((value: string) => {
    const roleId = value === "__none__" ? "" : value;
    setNewMemberRoleId(roleId);
    const role = roleDefinitions.find((r) => r.id === roleId);
    if (role) setNewMemberRate(role.msrpRate.toString());
  }, [roleDefinitions]);

  const handleEditRoleChange = useCallback((value: string) => {
    const roleId = value === "__none__" ? "" : value;
    setEditRoleId(roleId);
    const role = roleDefinitions.find((r) => r.id === roleId);
    if (role) setEditRate(role.msrpRate.toString());
  }, [roleDefinitions]);

  const handleAddMember = useCallback(async () => {
    if (!currentProject || !newMemberConsultantId) {
      setAddMemberError("Please select a resource");
      return;
    }
    if (members.some((m) => m.consultantId === newMemberConsultantId)) {
      setAddMemberError("This resource is already on the project");
      return;
    }
    setSavingMember(true);
    setAddMemberError(null);
    try {
      const rate = newMemberRate ? parseFloat(newMemberRate) : null;
      await upsertProjectMember(
        currentProject.id,
        newMemberConsultantId,
        newMemberRoleId || null,
        rate != null && !isNaN(rate) ? rate : null
      );

      const hours = newMemberWeeklyHours ? parseFloat(newMemberWeeklyHours) : null;
      if (hours != null && !isNaN(hours) && hours > 0 && newMemberFromDate && newMemberToDate) {
        await seedMemberAllocations(
          currentProject.id,
          newMemberConsultantId,
          hours,
          newMemberFromDate,
          newMemberToDate
        );
      }

      const consultant = allConsultants.find((c) => c.id === newMemberConsultantId);
      const role = roleDefinitions.find((r) => r.id === newMemberRoleId);
      setMembers((prev) => [
        ...prev,
        {
          consultantId: newMemberConsultantId,
          consultantName: consultant?.name ?? "",
          memberId: null,
          roleDefinitionId: newMemberRoleId || null,
          roleDefinitionName: role?.name ?? null,
          msrpRate: role?.msrpRate ?? null,
          billingRate: rate != null && !isNaN(rate) ? rate : null,
          fromAllocation: false,
        },
      ]);
      setAddingMember(false);
      setNewMemberConsultantId("");
      setNewMemberRoleId("");
      setNewMemberRate("");
      setNewMemberWeeklyHours("");
      setNewMemberFromDate("");
      setNewMemberToDate("");
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSavingMember(false);
    }
  }, [currentProject, newMemberConsultantId, newMemberRoleId, newMemberRate, newMemberWeeklyHours, newMemberFromDate, newMemberToDate, members, allConsultants, roleDefinitions]);

  const handleSaveMemberEdit = useCallback(async (consultantId: string) => {
    if (!currentProject) return;
    setSavingMember(true);
    try {
      const rate = editRate ? parseFloat(editRate) : null;
      await upsertProjectMember(
        currentProject.id,
        consultantId,
        editRoleId || null,
        rate != null && !isNaN(rate) ? rate : null
      );
      const role = roleDefinitions.find((r) => r.id === editRoleId);
      setMembers((prev) =>
        prev.map((m) =>
          m.consultantId === consultantId
            ? {
                ...m,
                roleDefinitionId: editRoleId || null,
                roleDefinitionName: role?.name ?? null,
                msrpRate: role?.msrpRate ?? null,
                billingRate: rate != null && !isNaN(rate) ? rate : null,
              }
            : m
        )
      );
      setEditingMemberId(null);
    } catch {
      // silent — could add error display here
    } finally {
      setSavingMember(false);
    }
  }, [currentProject, editRoleId, editRate, roleDefinitions]);

  const handleRemoveMember = useCallback(async (consultantId: string) => {
    if (!currentProject) return;
    try {
      await removeProjectMember(currentProject.id, consultantId);
      setMembers((prev) => prev.filter((m) => m.consultantId !== consultantId));
    } catch {
      // silent
    }
  }, [currentProject]);

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);
    try {
      const budgetVal = data.budget ? parseFloat(data.budget) : null;
      const discountVal = data.salesDiscount ? parseFloat(data.salesDiscount) : null;
      const apiData = {
        ...data,
        budget: budgetVal != null && !isNaN(budgetVal) ? budgetVal : null,
        salesDiscount: discountVal != null && !isNaN(discountVal) ? discountVal : null,
      };

      if (currentProject) {
        await updateProject(currentProject.id, apiData);
      } else {
        const created = await createProject(apiData);
        const newProject: ProjectWithRelations = {
          ...apiData,
          id: created.id,
          startDate: created.startDate,
          endDate: created.endDate,
          members: [],
        };
        setCurrentProject(newProject);
        if (!closeAfterSave.current) {
          setActiveTab("details");
        }
      }

      if (closeAfterSave.current) {
        form.reset();
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    closeAfterSave.current = false;
    form.handleSubmit(onSubmit)();
  };

  const handleSaveAndClose = () => {
    closeAfterSave.current = true;
    form.handleSubmit(onSubmit)();
  };

  const availableConsultants = allConsultants.filter(
    (c) => !members.some((m) => m.consultantId === c.id)
  );

  // Role options filtered to the selected/editing consultant's billing roles
  const addMemberRoleOptions = newMemberConsultantId
    ? roleDefinitions.filter((rd) => {
        const c = allConsultants.find((c) => c.id === newMemberConsultantId);
        return c ? c.billingRoleIds.includes(rd.id) : true;
      })
    : roleDefinitions;

  const editMemberRoleOptions = editingMemberId
    ? roleDefinitions.filter((rd) => {
        const c = allConsultants.find((c) => c.id === editingMemberId);
        return c ? c.billingRoleIds.includes(rd.id) : true;
      })
    : roleDefinitions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentProject ? "Edit Project" : "Create Project"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="team">
              Team{currentProject && members.length > 0 ? ` (${members.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* ── Basic Tab ── */}
          <TabsContent value="basic">
            <Form {...form}>
              <form className="space-y-4 pt-2">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                    {error}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="client"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Website Redesign" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timecode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timecode</FormLabel>
                      <FormControl>
                        <Input placeholder="ACME-WEB-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={ProjectType.BILLABLE}>Billable</SelectItem>
                            <SelectItem value={ProjectType.ASSIGNED}>Assigned</SelectItem>
                            <SelectItem value={ProjectType.FILLER}>Filler</SelectItem>
                            <SelectItem value={ProjectType.PROJECTED}>Projected</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={ProjectStatus.ACTIVE}>Active</SelectItem>
                            <SelectItem value={ProjectStatus.INACTIVE}>Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSave} disabled={loading}>
                    {loading ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" onClick={handleSaveAndClose} disabled={loading}>
                    {loading ? "Saving..." : "Save & Close"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* ── Details Tab ── */}
          <TabsContent value="details">
            <Form {...form}>
              <form className="space-y-4 pt-2">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                    {error}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="projectManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Manager</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select PM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {pemConsultants.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="salesManager"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Manager</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {(Object.keys(salesManagerLabels) as SalesManager[]).map((key) => (
                            <SelectItem key={key} value={key}>
                              {salesManagerLabels[key]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={Currency.USD}>USD</SelectItem>
                            <SelectItem value={Currency.CAD}>CAD</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contractType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Type</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                          value={field.value ?? "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            <SelectItem value={ContractType.MILESTONE}>Milestone</SelectItem>
                            <SelectItem value={ContractType.TM}>T&amp;M</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salesDiscount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Discount (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="healthStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Health</FormLabel>
                      <div className="flex gap-2">
                        {(["RED", "YELLOW", "GREEN"] as HealthStatus[]).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => field.onChange(field.value === h ? null : h)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors",
                              field.value === h
                                ? "border-primary bg-primary/10 font-medium"
                                : "border-border hover:bg-muted"
                            )}
                          >
                            <span className={cn("w-3 h-3 rounded-full", healthColors[h])} />
                            {healthLabels[h]}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comments</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes..."
                          rows={3}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSave} disabled={loading}>
                    {loading ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" onClick={handleSaveAndClose} disabled={loading}>
                    {loading ? "Saving..." : "Save & Close"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* ── Team Tab ── */}
          <TabsContent value="team">
            <div className="space-y-4 pt-2">
              {!currentProject ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Save the project first to manage team members.
                </p>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Resource</TableHead>
                          <TableHead>Billing Role</TableHead>
                          <TableHead className="text-right">Rate ($/hr)</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.length === 0 && !addingMember && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                              No resources assigned. Add a resource below or allocate hours on the utilization grid.
                            </TableCell>
                          </TableRow>
                        )}
                        {members.map((member) => (
                          <TableRow key={member.consultantId}>
                            <TableCell className="font-medium">
                              {member.consultantName}
                            </TableCell>
                            {editingMemberId === member.consultantId ? (
                              <>
                                <TableCell>
                                  <Select value={editRoleId || "__none__"} onValueChange={handleEditRoleChange}>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">— None —</SelectItem>
                                      {editMemberRoleOptions.map((r) => (
                                        <SelectItem key={r.id} value={r.id}>
                                          {r.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editRate}
                                    onChange={(e) => setEditRate(e.target.value)}
                                    className="h-8 text-xs w-24 ml-auto"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleSaveMemberEdit(member.consultantId)}
                                      disabled={savingMember}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-1"
                                      onClick={() => setEditingMemberId(null)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-sm text-muted-foreground">
                                  {member.roleDefinitionName ?? "—"}
                                </TableCell>
                                <TableCell className="text-right text-sm font-mono">
                                  {member.billingRate != null
                                    ? `$${member.billingRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : member.msrpRate != null
                                    ? <span className="text-muted-foreground">${member.msrpRate.toFixed(2)} (MSRP)</span>
                                    : "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setEditingMemberId(member.consultantId);
                                        setEditRoleId(member.roleDefinitionId ?? "");
                                        setEditRate(
                                          member.billingRate?.toString() ??
                                          member.msrpRate?.toString() ??
                                          ""
                                        );
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => handleRemoveMember(member.consultantId)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}

                      </TableBody>
                    </Table>
                  </div>

                  {addingMember && (
                    <div className="border rounded-md p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Resource</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Resource</label>
                          <Select value={newMemberConsultantId} onValueChange={setNewMemberConsultantId}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select resource" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableConsultants.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Billing Role</label>
                          <Select value={newMemberRoleId || "__none__"} onValueChange={handleNewRoleChange}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— None —</SelectItem>
                              {addMemberRoleOptions.map((r) => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Rate ($/hr)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newMemberRate}
                            onChange={(e) => setNewMemberRate(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Default Hrs/wk</label>
                          <Input
                            type="number"
                            min="0"
                            max="80"
                            step="0.5"
                            placeholder="optional"
                            value={newMemberWeeklyHours}
                            onChange={(e) => setNewMemberWeeklyHours(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      {parseFloat(newMemberWeeklyHours) > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">From week</label>
                            <Input
                              type="date"
                              value={newMemberFromDate}
                              onChange={(e) => setNewMemberFromDate(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">To week</label>
                            <Input
                              type="date"
                              value={newMemberToDate}
                              onChange={(e) => setNewMemberToDate(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      {addMemberError && (
                        <p className="text-xs text-red-600">{addMemberError}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingMember(false);
                            setAddMemberError(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddMember}
                          disabled={savingMember}
                        >
                          {savingMember ? "Adding..." : "Add"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {addMemberError && !addingMember && (
                    <p className="text-sm text-red-600">{addMemberError}</p>
                  )}

                  {!addingMember && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddingMember(true);
                        setNewMemberConsultantId("");
                        setNewMemberRoleId("");
                        setNewMemberRate("");
                        setNewMemberWeeklyHours("");
                        setNewMemberFromDate(getCurrentWeekSunday());
                        setNewMemberToDate(currentProject?.endDate ? toDateInput(currentProject.endDate) : "");
                        setAddMemberError(null);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add Resource
                    </Button>
                  )}
                </>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
