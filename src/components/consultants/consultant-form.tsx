"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GroupType, OvertimePreference, Consultant, ConsultantGroup, ConsultantBillingRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { createConsultant, updateConsultant } from "@/app/actions/consultants";
import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  netSuiteName: z.string().optional().nullable(),
  standardHours: z.number().min(0).max(80),
  overtimePreference: z.nativeEnum(OvertimePreference),
  overtimeHoursAvailable: z.number().min(0).max(40),
  managerId: z.string().optional().nullable(),
  groups: z.array(z.nativeEnum(GroupType)).min(1, "At least one group is required"),
  billingRoleIds: z.array(z.string()).min(1, "At least one billing role is required"),
});

type FormData = z.infer<typeof formSchema>;

type ConsultantWithRelations = Consultant & {
  groups: ConsultantGroup[];
  billingRoles: (ConsultantBillingRole & {
    roleDefinition: { id: string; name: string };
  })[];
};

type UserOption = {
  id: string;
  email: string;
  role: string;
  consultant: { id: string; name: string } | null;
};

interface ConsultantFormProps {
  consultant?: ConsultantWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users?: UserOption[];
  roleDefinitions?: { id: string; name: string }[];
}

const GROUP_LABELS: Record<GroupType, string> = {
  TECH: "Tech",
  FABA: "FA/BA",
  PEM: "PEM",
  SA: "SA",
  SYSADMIN: "Sys Admin",
  WEBUX: "WebUX",
  INTRASEE: "IntraSee",
  MGDSVC: "Managed Services",
  STAFFAUG: "Staff Aug",
  PRODUCT: "Product",
};

const groupOptions = Object.values(GroupType).map((v) => ({ value: v, label: GROUP_LABELS[v] }));

export function ConsultantForm({
  consultant,
  open,
  onOpenChange,
  users = [],
  roleDefinitions = [],
}: ConsultantFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      netSuiteName: "",
      standardHours: 40,
      overtimePreference: OvertimePreference.NONE,
      overtimeHoursAvailable: 0,
      managerId: "",
      groups: [],
      billingRoleIds: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: consultant?.name || "",
        netSuiteName: consultant?.netSuiteName || "",
        standardHours: consultant?.standardHours || 40,
        overtimePreference: consultant?.overtimePreference || OvertimePreference.NONE,
        overtimeHoursAvailable: consultant?.overtimeHoursAvailable || 0,
        managerId: consultant?.managerId || "",
        groups: consultant?.groups.map((g) => g.group) || [],
        billingRoleIds: consultant?.billingRoles.map((br) => br.roleDefinitionId) || [],
      });
      setError(null);
      setRoleSearch("");
    }
  }, [consultant, open, form]);

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);
    try {
      if (consultant) {
        await updateConsultant(consultant.id, data);
      } else {
        await createConsultant(data);
      }
      form.reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {consultant ? "Edit Consultant" : "Add Consultant"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {error}
              </div>
            )}

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="netSuiteName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NetSuite Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Legal name as it appears in NetSuite"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Used to match actuals upload rows. Leave blank to match on Name above.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Standard Hours + Manager */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="standardHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standard Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Weekly standard hours</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {users
                          .filter((u) => u.role === "ADMIN" || u.role === "MANAGER")
                          .filter((u) => u.consultant)
                          .map((user) => (
                            <SelectItem key={user.consultant!.id} value={user.consultant!.id}>
                              {user.consultant!.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Overtime */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="overtimePreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime Preference</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select preference" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={OvertimePreference.NONE}>None</SelectItem>
                        <SelectItem value={OvertimePreference.LIMITED}>Limited</SelectItem>
                        <SelectItem value={OvertimePreference.OPEN}>Open</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="overtimeHoursAvailable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OT Hours Available</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Groups — table + select to add */}
            <Controller
              control={form.control}
              name="groups"
              render={({ field, fieldState }) => {
                const unselected = groupOptions.filter((o) => !field.value.includes(o.value));
                return (
                  <FormItem>
                    <FormLabel>Groups</FormLabel>
                    <FormDescription>Practice groups this consultant belongs to</FormDescription>

                    {field.value.length > 0 && (
                      <div className="border rounded-md divide-y mt-2">
                        {field.value.map((g) => (
                          <div key={g} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span>{GROUP_LABELS[g]}</span>
                            <button
                              type="button"
                              onClick={() => field.onChange(field.value.filter((v) => v !== g))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {unselected.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(v) => field.onChange([...field.value, v as GroupType])}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Add group…" />
                        </SelectTrigger>
                        <SelectContent>
                          {unselected.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {fieldState.error && (
                      <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>
                    )}
                  </FormItem>
                );
              }}
            />

            {/* Billing Roles — table + searchable add */}
            <Controller
              control={form.control}
              name="billingRoleIds"
              render={({ field, fieldState }) => {
                const selectedRoles = roleDefinitions.filter((r) => field.value.includes(r.id));
                const unselectedRoles = roleDefinitions.filter((r) => !field.value.includes(r.id));
                const filtered = unselectedRoles.filter((r) =>
                  r.name.toLowerCase().includes(roleSearch.toLowerCase())
                );

                return (
                  <FormItem>
                    <FormLabel>Billing Roles</FormLabel>
                    <FormDescription>All roles this consultant can bill under</FormDescription>

                    {selectedRoles.length > 0 && (
                      <div className="border rounded-md divide-y mt-2">
                        {selectedRoles.map((r) => (
                          <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span>{r.name}</span>
                            <button
                              type="button"
                              onClick={() => field.onChange(field.value.filter((id) => id !== r.id))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {unselectedRoles.length > 0 && (
                      <div className="mt-2 border rounded-md">
                        <div className="flex items-center px-3 border-b">
                          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <input
                            type="text"
                            placeholder="Search roles to add…"
                            value={roleSearch}
                            onChange={(e) => setRoleSearch(e.target.value)}
                            className="w-full py-2 pl-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto divide-y">
                          {filtered.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">No roles match</p>
                          ) : (
                            filtered.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  field.onChange([...field.value, r.id]);
                                  setRoleSearch("");
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                              >
                                {r.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {roleDefinitions.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        No billing roles configured. Add roles in the Roles setup page.
                      </p>
                    )}

                    {fieldState.error && (
                      <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>
                    )}
                  </FormItem>
                );
              }}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : consultant ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
