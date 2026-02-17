"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addWeeks, subWeeks } from "date-fns";

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
  startDate: Date;
  endDate: Date;
  onDateRangeChange: (start: Date, end: Date) => void;
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
  startDate,
  endDate,
  onDateRangeChange,
}: GridFiltersProps) {
  const shiftWeeks = (direction: number) => {
    const weeks = direction * 4; // Shift by 4 weeks at a time
    onDateRangeChange(addWeeks(startDate, weeks), addWeeks(endDate, weeks));
  };

  return (
    <div className="space-y-4">
      {/* Row 1: View mode and date navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="actual">Actuals</TabsTrigger>
            <TabsTrigger value="projected">Projected</TabsTrigger>
            <TabsTrigger value="difference">Difference</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date range navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftWeeks(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="date"
              value={format(startDate, "yyyy-MM-dd")}
              onChange={(e) => {
                const newStart = new Date(e.target.value);
                if (!isNaN(newStart.getTime())) {
                  onDateRangeChange(newStart, endDate);
                }
              }}
              className="w-[140px]"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={format(endDate, "yyyy-MM-dd")}
              onChange={(e) => {
                const newEnd = new Date(e.target.value);
                if (!isNaN(newEnd.getTime())) {
                  onDateRangeChange(startDate, newEnd);
                }
              }}
              className="w-[140px]"
            />
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
        </div>
      </div>
    </div>
  );
}
