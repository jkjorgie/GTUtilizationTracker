"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { AllocationEntryType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createMassLoad, previewMassLoad, MassLoadFormData } from "@/app/actions/mass-load";

const formSchema = z.object({
  consultantIds: z.array(z.string()).min(1, "Select at least one consultant"),
  projectId: z.string().min(1, "Project is required"),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date().optional(),
  hours: z.number().min(0.5).max(80),
  entryType: z.nativeEnum(AllocationEntryType),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MassLoadFormProps {
  consultants: Array<{ id: string; name: string; standardHours: number }>;
  projects: Array<{ id: string; client: string; projectName: string; timecode: string }>;
}

interface PreviewData {
  consultantCount: number;
  consultantNames: string[];
  weekCount: number;
  totalAllocations: number;
  totalHours: number;
  project: string;
}

export function MassLoadForm({ consultants, projects }: MassLoadFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ created: number; updated: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      consultantIds: [],
      projectId: "",
      hours: 8,
      entryType: AllocationEntryType.ACTUAL,
      notes: "",
    },
  });

  const selectedConsultants = form.watch("consultantIds");

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      form.setValue("consultantIds", consultants.map((c) => c.id));
    } else {
      form.setValue("consultantIds", []);
    }
  };

  const handlePreview = async () => {
    const valid = await form.trigger();
    if (!valid) return;

    setPreviewing(true);
    setError(null);
    setPreview(null);

    try {
      const data = form.getValues();
      const result = await previewMassLoad({
        consultantIds: data.consultantIds,
        projectId: data.projectId,
        startDate: format(data.startDate, "yyyy-MM-dd"),
        endDate: data.endDate ? format(data.endDate, "yyyy-MM-dd") : undefined,
        hours: data.hours,
        entryType: data.entryType,
        notes: data.notes,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await createMassLoad({
        consultantIds: data.consultantIds,
        projectId: data.projectId,
        startDate: format(data.startDate, "yyyy-MM-dd"),
        endDate: data.endDate ? format(data.endDate, "yyyy-MM-dd") : undefined,
        hours: data.hours,
        entryType: data.entryType,
        notes: data.notes,
      });

      if (result.errors.length > 0) {
        setError(`Completed with errors: ${result.errors.join(", ")}`);
      }

      setSuccess({ created: result.created, updated: result.updated });
      setPreview(null);
      form.reset();
      setSelectAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Mass Load Allocations</CardTitle>
          <CardDescription>
            Quickly assign hours to multiple consultants at once. Use for holidays, company events, or bulk assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md">
                  Successfully created {success.created} and updated {success.updated} allocations.
                </div>
              )}

              <FormField
                control={form.control}
                name="consultantIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Consultants</FormLabel>
                    <FormDescription>
                      Select consultants to assign hours
                    </FormDescription>
                    <div className="border rounded-md">
                      <div className="p-2 border-b bg-muted/50">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                          />
                          <span className="text-sm font-medium">
                            Select All ({consultants.length})
                          </span>
                          <span className="text-sm text-muted-foreground ml-auto">
                            {selectedConsultants.length} selected
                          </span>
                        </div>
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-2 space-y-1">
                          {consultants.map((consultant) => (
                            <FormField
                              key={consultant.id}
                              control={form.control}
                              name="consultantIds"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2 space-y-0 py-1">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(consultant.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.onChange([...field.value, consultant.id]);
                                        } else {
                                          field.onChange(
                                            field.value.filter((id) => id !== consultant.id)
                                          );
                                          setSelectAll(false);
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer flex-1">
                                    {consultant.name}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timecode / Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.timecode} - {project.projectName}
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : "Same as start"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>Leave empty for single day</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours per Week</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={AllocationEntryType.ACTUAL}>
                            Actual
                          </SelectItem>
                          <SelectItem value={AllocationEntryType.PROJECTED}>
                            Projected
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Company Holiday - Presidents Day"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewing || loading}
                >
                  {previewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Preview
                </Button>
                <Button type="submit" disabled={loading || !preview}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Allocations
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Review what will be created before submitting
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!preview ? (
            <div className="py-8 text-center text-muted-foreground">
              Click &quot;Preview&quot; to see what will be created
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Consultants</p>
                  <p className="text-2xl font-bold">{preview.consultantCount}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Weeks</p>
                  <p className="text-2xl font-bold">{preview.weekCount}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Allocations</p>
                  <p className="text-2xl font-bold">{preview.totalAllocations}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">{preview.totalHours}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Project</p>
                <p className="font-medium">{preview.project}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Consultants ({preview.consultantNames.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {preview.consultantNames.slice(0, 10).map((name) => (
                    <span
                      key={name}
                      className="px-2 py-1 text-xs bg-muted rounded"
                    >
                      {name}
                    </span>
                  ))}
                  {preview.consultantNames.length > 10 && (
                    <span className="px-2 py-1 text-xs text-muted-foreground">
                      +{preview.consultantNames.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
