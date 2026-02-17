"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GroupType, RoleLevel, OvertimePreference, Consultant, ConsultantGroup, ConsultantRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  standardHours: z.number().min(0).max(80),
  overtimePreference: z.nativeEnum(OvertimePreference),
  overtimeHoursAvailable: z.number().min(0).max(40),
  hrManager: z.string().optional(),
  groups: z.array(z.nativeEnum(GroupType)).min(1, "At least one group is required"),
  roles: z.array(z.nativeEnum(RoleLevel)).min(1, "At least one role is required"),
});

type FormData = z.infer<typeof formSchema>;

type ConsultantWithRelations = Consultant & {
  groups: ConsultantGroup[];
  roles: ConsultantRole[];
};

interface ConsultantFormProps {
  consultant?: ConsultantWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const groupOptions = [
  { value: GroupType.TECH, label: "Tech" },
  { value: GroupType.FABA, label: "FA/BA" },
  { value: GroupType.PEM, label: "PEM" },
  { value: GroupType.SA, label: "SA" },
];

const roleOptions = [
  { value: RoleLevel.T1, label: "T1" },
  { value: RoleLevel.T2, label: "T2" },
  { value: RoleLevel.T3, label: "T3" },
  { value: RoleLevel.STA, label: "STA" },
  { value: RoleLevel.PTA, label: "PTA" },
  { value: RoleLevel.LTA, label: "LTA" },
  { value: RoleLevel.FA1, label: "FA1" },
  { value: RoleLevel.FA2, label: "FA2" },
  { value: RoleLevel.FA3, label: "FA3" },
  { value: RoleLevel.SBA, label: "SBA" },
  { value: RoleLevel.PBA, label: "PBA" },
  { value: RoleLevel.LBA, label: "LBA" },
  { value: RoleLevel.EM1, label: "EM1" },
  { value: RoleLevel.EM2, label: "EM2" },
  { value: RoleLevel.EM3, label: "EM3" },
  { value: RoleLevel.PM, label: "PM" },
];

export function ConsultantForm({ consultant, open, onOpenChange }: ConsultantFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      standardHours: 40,
      overtimePreference: OvertimePreference.NONE,
      overtimeHoursAvailable: 0,
      hrManager: "",
      groups: [],
      roles: [],
    },
  });

  // Reset form when consultant changes (for edit mode)
  useEffect(() => {
    if (open) {
      form.reset({
        name: consultant?.name || "",
        standardHours: consultant?.standardHours || 40,
        overtimePreference: consultant?.overtimePreference || OvertimePreference.NONE,
        overtimeHoursAvailable: consultant?.overtimeHoursAvailable || 0,
        hrManager: consultant?.hrManager || "",
        groups: consultant?.groups.map(g => g.group) || [],
        roles: consultant?.roles.map(r => r.level) || [],
      });
      setError(null);
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {error}
              </div>
            )}

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
                name="hrManager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HR Manager</FormLabel>
                    <FormControl>
                      <Input placeholder="Manager name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="overtimePreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime Preference</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
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

            <FormField
              control={form.control}
              name="groups"
              render={() => (
                <FormItem>
                  <FormLabel>Groups</FormLabel>
                  <FormDescription>Select all applicable groups</FormDescription>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {groupOptions.map((option) => (
                      <FormField
                        key={option.value}
                        control={form.control}
                        name="groups"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(option.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, option.value]);
                                  } else {
                                    field.onChange(field.value.filter((v) => v !== option.value));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {option.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roles"
              render={() => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <FormDescription>Select all applicable roles</FormDescription>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {roleOptions.map((option) => (
                      <FormField
                        key={option.value}
                        control={form.control}
                        name="roles"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(option.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, option.value]);
                                  } else {
                                    field.onChange(field.value.filter((v) => v !== option.value));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {option.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
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
