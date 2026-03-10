"use client";

import { useState, useMemo } from "react";
import { ProjectType, ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectForm, ProjectWithRelations } from "./project-form";
import { ProjectTable } from "./project-table";
import { Plus, Search } from "lucide-react";

type ProjectRow = ProjectWithRelations & {
  projectManager: { id: string; name: string } | null;
};

interface ProjectsViewProps {
  projects: ProjectRow[];
  pemConsultants: { id: string; name: string }[];
  roleDefinitions: { id: string; name: string; msrpRate: number; category: string }[];
  allConsultants: { id: string; name: string; billingRoleIds: string[] }[];
}

export function ProjectsView({ projects, pemConsultants, roleDefinitions, allConsultants }: ProjectsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (typeFilter !== "all" && project.type !== typeFilter) return false;
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          project.client.toLowerCase().includes(q) ||
          project.projectName.toLowerCase().includes(q) ||
          (project.timecode ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, typeFilter, statusFilter, search]);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage project timecodes and settings</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search client, project, timecode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value={ProjectType.BILLABLE}>Billable</SelectItem>
              <SelectItem value={ProjectType.ASSIGNED}>Assigned</SelectItem>
              <SelectItem value={ProjectType.FILLER}>Filler</SelectItem>
              <SelectItem value={ProjectType.PROJECTED}>Projected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={ProjectStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={ProjectStatus.INACTIVE}>Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Projects ({filteredProjects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectTable
            projects={filteredProjects}
            pemConsultants={pemConsultants}
            roleDefinitions={roleDefinitions}
            allConsultants={allConsultants}
          />
        </CardContent>
      </Card>

      <ProjectForm
        open={showForm}
        onOpenChange={setShowForm}
        pemConsultants={pemConsultants}
        roleDefinitions={roleDefinitions}
        allConsultants={allConsultants}
      />
    </>
  );
}
