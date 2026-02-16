"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectForm } from "./project-form";
import { Plus, Search } from "lucide-react";
import { ProjectType, ProjectStatus } from "@prisma/client";

export function ProjectsHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const updateFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/projects?${params.toString()}`);
  }, [router, searchParams]);

  // Debounced search - updates as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get("search") || "";
      if (search !== currentSearch) {
        updateFilter("search", search || null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, searchParams, updateFilter]);

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
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={searchParams.get("type") || "all"}
            onValueChange={(value) => updateFilter("type", value)}
          >
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

          <Select
            value={searchParams.get("status") || "all"}
            onValueChange={(value) => updateFilter("status", value)}
          >
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

      <ProjectForm
        open={showForm}
        onOpenChange={setShowForm}
      />
    </>
  );
}
