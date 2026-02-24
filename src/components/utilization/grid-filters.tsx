"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import {
  format,
  addWeeks,
  subWeeks,
  startOfWeek,
  eachWeekOfInterval,
  parseISO,
} from "date-fns";

interface GridFiltersProps {
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  groupFilter: string;
  onGroupFilterChange: (group: string) => void;
  searchFilter: string;
  onSearchFilterChange: (search: string) => void;
  roles: string[];
  groups: string[];
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (start: Date, end: Date) => void;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
  projects: Array<{ id: string; projectName: string; timecode: string }>;
  projectFilter: string[];
  onProjectFilterChange: (filter: string[]) => void;
}

export function GridFilters({
  roleFilter,
  onRoleFilterChange,
  groupFilter,
  onGroupFilterChange,
  searchFilter,
  onSearchFilterChange,
  roles,
  groups,
  startDate,
  endDate,
  onDateRangeChange,
  allExpanded,
  onToggleExpandAll,
  projects,
  projectFilter,
  onProjectFilterChange,
}: GridFiltersProps) {
  const [projectSearch, setProjectSearch] = useState("");

  const shiftWeeks = (direction: number) => {
    const weeks = direction * 4;
    onDateRangeChange(addWeeks(startDate, weeks), addWeeks(endDate, weeks));
  };

  const availableWeeks = useMemo(() => {
    const currentSunday = startOfWeek(new Date(), { weekStartsOn: 0 });
    const baseStart = subWeeks(currentSunday, 52);
    const baseEnd = addWeeks(currentSunday, 78);
    const rangeStart = startDate < baseStart ? subWeeks(startDate, 4) : baseStart;
    const rangeEnd = endDate > baseEnd ? addWeeks(endDate, 4) : baseEnd;
    return eachWeekOfInterval(
      { start: rangeStart, end: rangeEnd },
      { weekStartsOn: 0 }
    );
  }, [startDate, endDate]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.timecode.localeCompare(b.timecode));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return sortedProjects;
    const q = projectSearch.toLowerCase();
    return sortedProjects.filter(
      p => p.timecode.toLowerCase().includes(q) || p.projectName.toLowerCase().includes(q)
    );
  }, [sortedProjects, projectSearch]);

  const toggleProject = (timecode: string) => {
    if (projectFilter.includes(timecode)) {
      onProjectFilterChange(projectFilter.filter(t => t !== timecode));
    } else {
      onProjectFilterChange([...projectFilter, timecode]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Expand/collapse toggle and date navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" size="sm" onClick={onToggleExpandAll}>
          {allExpanded ? "Collapse All" : "Expand All"}
        </Button>

        {/* Date range navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftWeeks(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 text-sm">
            <Select
              value={format(startDate, "yyyy-MM-dd")}
              onValueChange={(v) => {
                const newStart = parseISO(v);
                const adjustedEnd = newStart >= endDate ? addWeeks(newStart, 13) : endDate;
                onDateRangeChange(newStart, adjustedEnd);
              }}
            >
              <SelectTrigger className="w-[185px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableWeeks.map((sunday) => {
                  const val = format(sunday, "yyyy-MM-dd");
                  return (
                    <SelectItem key={val} value={val}>
                      Wk of {format(sunday, "MMM d, yyyy")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">to</span>

            <Select
              value={format(endDate, "yyyy-MM-dd")}
              onValueChange={(v) => {
                const newEnd = parseISO(v);
                const adjustedStart = newEnd <= startDate ? subWeeks(newEnd, 13) : startDate;
                onDateRangeChange(adjustedStart, newEnd);
              }}
            >
              <SelectTrigger className="w-[185px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableWeeks.map((sunday) => {
                  const val = format(sunday, "yyyy-MM-dd");
                  return (
                    <SelectItem key={val} value={val}>
                      Wk of {format(sunday, "MMM d, yyyy")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="icon" onClick={() => shiftWeeks(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Row 2: Search and filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search consultants..."
            value={searchFilter}
            onChange={(e) => onSearchFilterChange(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex gap-2">
          <Select value={roleFilter} onValueChange={onRoleFilterChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={groupFilter} onValueChange={onGroupFilterChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Project code filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-1.5">
                <Filter className="h-4 w-4" />
                Projects
                {projectFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-xs">
                    {projectFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-3" align="start">
              <div className="space-y-3">
                <Input
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="h-8"
                />
                <ScrollArea className="h-[220px]">
                  <div className="space-y-1">
                    {filteredProjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No projects found
                      </p>
                    ) : (
                      filteredProjects.map((project) => (
                        <label
                          key={project.id}
                          className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={projectFilter.includes(project.timecode)}
                            onCheckedChange={() => toggleProject(project.timecode)}
                          />
                          <span className="text-sm truncate">
                            <span className="font-mono">{project.timecode}</span>
                            {" - "}
                            {project.projectName}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {projectFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onProjectFilterChange([])}
                  >
                    Clear filter
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
