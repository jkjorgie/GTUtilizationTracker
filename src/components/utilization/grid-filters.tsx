"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export type ViewMode = "actual" | "projected" | "difference";

interface GridFiltersProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  groupFilter: string;
  onGroupFilterChange: (group: string) => void;
  searchFilter: string;
  onSearchFilterChange: (search: string) => void;
  roles: string[];
  groups: string[];
}

export function GridFilters({
  viewMode,
  onViewModeChange,
  roleFilter,
  onRoleFilterChange,
  groupFilter,
  onGroupFilterChange,
  searchFilter,
  onSearchFilterChange,
  roles,
  groups,
}: GridFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="actual">Actuals</TabsTrigger>
          <TabsTrigger value="projected">Projected</TabsTrigger>
          <TabsTrigger value="difference">Difference</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search consultants..."
            value={searchFilter}
            onChange={(e) => onSearchFilterChange(e.target.value)}
            className="pl-8 w-full sm:w-[200px]"
          />
        </div>

        <Select value={roleFilter} onValueChange={onRoleFilterChange}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role.replace("LVL", "Level ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={groupFilter} onValueChange={onGroupFilterChange}>
          <SelectTrigger className="w-full sm:w-[120px]">
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
      </div>
    </div>
  );
}
