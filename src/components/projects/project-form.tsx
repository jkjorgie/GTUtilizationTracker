"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProjectType, ProjectStatus, Project } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createProject, updateProject } from "@/app/actions/projects";
import { useState, useEffect } from "react";

const formSchema = z.object({
  client: z.string().min(1, "Client is required"),
  projectName: z.string().min(1, "Project name is required"),
  timecode: z.string().min(1, "Timecode is required"),
  type: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
});

type FormData = z.infer<typeof formSchema>;

interface ProjectFormProps {
  project?: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectForm({ project, open, onOpenChange }: ProjectFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client: "",
      projectName: "",
      timecode: "",
      type: ProjectType.BILLABLE,
      status: ProjectStatus.ACTIVE,
    },
  });

  // Reset form when project changes (for edit mode)
  useEffect(() => {
    if (open) {
      form.reset({
        client: project?.client || "",
        projectName: project?.projectName || "",
        timecode: project?.timecode || "",
        type: project?.type || ProjectType.BILLABLE,
        status: project?.status || ProjectStatus.ACTIVE,
      });
      setError(null);
    }
  }, [project, open, form]);

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);

    try {
      if (project) {
        await updateProject(project.id, data);
      } else {
        await createProject(data);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit Project" : "Create Project"}
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ProjectType.BILLABLE}>
                          Billable
                        </SelectItem>
                        <SelectItem value={ProjectType.ASSIGNED}>
                          Assigned
                        </SelectItem>
                        <SelectItem value={ProjectType.FILLER}>
                          Filler
                        </SelectItem>
                        <SelectItem value={ProjectType.PROJECTED}>
                          Projected
                        </SelectItem>
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ProjectStatus.ACTIVE}>
                          Active
                        </SelectItem>
                        <SelectItem value={ProjectStatus.INACTIVE}>
                          Inactive
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : project ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
