"use client";

import { useState, useCallback } from "react";
import { ProjectType, ProjectStatus, HealthStatus } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions/projects";
import { getProjectMembers } from "@/app/actions/project-members";
import { ProjectForm, ProjectWithRelations } from "./project-form";

// ProjectRow is the shape returned by getProjects() (with projectManager included)
type ProjectRow = ProjectWithRelations & {
  projectManager: { id: string; name: string } | null;
};

interface ProjectTableProps {
  projects: ProjectRow[];
  pemConsultants: { id: string; name: string }[];
  roleDefinitions: { id: string; name: string; msrpRate: number; category: string }[];
  allConsultants: { id: string; name: string; billingRoleIds: string[] }[];
}

const typeColors: Record<ProjectType, string> = {
  BILLABLE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  ASSIGNED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  FILLER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  PROJECTED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
};

const statusColors: Record<ProjectStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  INACTIVE: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200",
  ON_DEMAND: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
};

const healthDotColors: Record<HealthStatus, string> = {
  RED: "bg-red-500",
  YELLOW: "bg-yellow-400",
  GREEN: "bg-green-500",
};

export function ProjectTable({ projects, pemConsultants, roleDefinitions, allConsultants }: ProjectTableProps) {
  const [editingProject, setEditingProject] = useState<ProjectWithRelations | null>(null);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<ProjectRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenEdit = useCallback(async (project: ProjectRow) => {
    // Open form immediately with project data, then lazily load members
    setEditingProject(project);
    setEditFormOpen(true);
    try {
      const members = await getProjectMembers(project.id);
      setEditingProject((prev) => prev ? { ...prev, members } : prev);
    } catch {
      // members won't be pre-loaded, user can still navigate to Team tab
    }
  }, []);

  const handleDelete = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      await deleteProject(deletingProject.id);
      setDeletingProject(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24px]"></TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Timecode</TableHead>
              <TableHead>PM</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No projects found
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="pr-0">
                    {project.healthStatus ? (
                      <span
                        className={cn("block w-2.5 h-2.5 rounded-full mx-auto", healthDotColors[project.healthStatus])}
                        title={project.healthStatus}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="font-medium">{project.client}</TableCell>
                  <TableCell>{project.projectName}</TableCell>
                  <TableCell className="font-mono text-sm">{project.timecode}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.projectManager?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={typeColors[project.type]}>
                      {project.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[project.status]}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(project)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingProject(project)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProjectForm
        project={editingProject}
        open={editFormOpen}
        onOpenChange={(open) => {
          setEditFormOpen(open);
          if (!open) setEditingProject(null);
        }}
        pemConsultants={pemConsultants}
        roleDefinitions={roleDefinitions}
        allConsultants={allConsultants}
      />

      <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingProject?.projectName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteError(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
