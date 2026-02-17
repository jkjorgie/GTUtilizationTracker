"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { format, parseISO, subWeeks, addWeeks, startOfWeek } from "date-fns";
import { UtilizationData, getUtilizationData } from "@/app/actions/utilization";
import { getUtilizationStatus, groupWeeksByMonth } from "@/lib/utils";
import { WeekCell } from "./week-cell";
import { GridFilters, ViewMode } from "./grid-filters";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface UtilizationGridProps {
  initialData: UtilizationData;
  projects: Array<{ id: string; projectName: string; timecode: string }>;
  userRole: string;
  currentConsultantId?: string | null;
}

export function UtilizationGrid({ 
  initialData, 
  projects, 
  userRole, 
  currentConsultantId 
}: UtilizationGridProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<UtilizationData>(initialData);
  
  // Date range state
  const today = new Date();
  const defaultStart = subWeeks(startOfWeek(today, { weekStartsOn: 0 }), 4);
  const defaultEnd = addWeeks(startOfWeek(today, { weekStartsOn: 0 }), 8);
  
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  
  const [viewMode, setViewMode] = useState<ViewMode>("actual");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Fetch data when date range changes
  const handleDateRangeChange = useCallback((newStart: Date, newEnd: Date) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    
    startTransition(async () => {
      try {
        const newData = await getUtilizationData(
          format(newStart, "yyyy-MM-dd"),
          format(newEnd, "yyyy-MM-dd")
        );
        setData(newData);
      } catch (error) {
        console.error("Failed to fetch utilization data:", error);
      }
    });
  }, []);

  // Group weeks by month for the header
  const weekDates = useMemo(
    () => data.weeks.map((w) => parseISO(w)),
    [data.weeks]
  );
  
  const monthGroups = useMemo(
    () => groupWeeksByMonth(weekDates),
    [weekDates]
  );

  // Filter consultants
  const filteredConsultants = useMemo(() => {
    return data.consultants.filter((consultant) => {
      // Role filter
      if (roleFilter !== "all" && !consultant.roles.includes(roleFilter)) {
        return false;
      }
      // Group filter
      if (groupFilter !== "all" && !consultant.groups.includes(groupFilter)) {
        return false;
      }
      // Search filter
      if (searchFilter && !consultant.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [data.consultants, roleFilter, groupFilter, searchFilter]);

  const getCellDetails = useCallback(
    (consultantId: string, week: string) => {
      return data.allocations[consultantId]?.[week]?.details || [];
    },
    [data.allocations]
  );

  const canEdit = useCallback(
    (consultantId: string) => {
      if (viewMode === "difference") return false;
      if (userRole === "ADMIN" || userRole === "MANAGER") return true;
      return consultantId === currentConsultantId;
    },
    [viewMode, userRole, currentConsultantId]
  );

  // Get unique roles and groups for filter dropdowns
  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    data.consultants.forEach((c) => c.roles.forEach((r) => roles.add(r)));
    return Array.from(roles).sort();
  }, [data.consultants]);

  const allGroups = useMemo(() => {
    const groups = new Set<string>();
    data.consultants.forEach((c) => c.groups.forEach((g) => groups.add(g)));
    return Array.from(groups).sort();
  }, [data.consultants]);

  return (
    <div className="space-y-4">
      <GridFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        searchFilter={searchFilter}
        onSearchFilterChange={setSearchFilter}
        roles={allRoles}
        groups={allGroups}
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={handleDateRangeChange}
      />

      <div className="border rounded-lg overflow-hidden relative">
        {isPending && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        <ScrollArea className="w-full">
          <div className="min-w-max">
            {/* Header Row 1: Months */}
            <div className="flex border-b bg-muted/50">
              <div className="w-24 min-w-24 p-2 border-r font-medium text-sm sticky left-0 bg-muted/50 z-20">
                Role
              </div>
              <div className="w-40 min-w-40 p-2 border-r font-medium text-sm sticky left-24 bg-muted/50 z-20">
                Name
              </div>
              {Array.from(monthGroups.entries()).map(([monthKey, weeks]) => (
                <div
                  key={monthKey}
                  className="border-r text-center font-medium text-sm p-2 bg-muted/50"
                  style={{ width: `${weeks.length * 64}px`, minWidth: `${weeks.length * 64}px` }}
                >
                  {format(weeks[0], "MMMM yyyy")}
                </div>
              ))}
            </div>

            {/* Header Row 2: Week dates */}
            <div className="flex border-b bg-muted/30">
              <div className="w-24 min-w-24 p-2 border-r sticky left-0 bg-muted/30 z-20" />
              <div className="w-40 min-w-40 p-2 border-r sticky left-24 bg-muted/30 z-20" />
              {data.weeks.map((week) => (
                <div
                  key={week}
                  className="w-16 min-w-16 p-1 border-r text-center text-xs text-muted-foreground"
                >
                  {format(parseISO(week), "M/d")}
                </div>
              ))}
            </div>

            {/* Data Rows */}
            {filteredConsultants.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No consultants match the current filters
              </div>
            ) : (
              filteredConsultants.map((consultant) => (
                <div key={consultant.id} className="flex border-b hover:bg-muted/20">
                  {/* Role column - sticky */}
                  <div className="w-24 min-w-24 p-2 border-r sticky left-0 bg-background z-10">
                    <div className="flex flex-wrap gap-1">
                      {consultant.roles.slice(0, 2).map((role) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Name column - sticky */}
                  <div className="w-40 min-w-40 p-2 border-r sticky left-24 bg-background z-10">
                    <span className="font-medium text-sm truncate block">
                      {consultant.name}
                    </span>
                    <div className="flex gap-1 mt-1">
                      {consultant.groups.slice(0, 2).map((group) => (
                        <span key={group} className="text-xs text-muted-foreground">
                          {group}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Week cells */}
                  {data.weeks.map((week) => {
                    const details = getCellDetails(consultant.id, week);
                    const editable = canEdit(consultant.id);

                    return (
                      <WeekCell
                        key={week}
                        consultantId={consultant.id}
                        consultantName={consultant.name}
                        week={week}
                        details={details}
                        standardHours={consultant.standardHours}
                        editable={editable}
                        viewMode={viewMode}
                        projects={projects}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30" />
          <span>Normal (90-110%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30" />
          <span>Under-utilized (&lt;90%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
          <span>Over-utilized (&gt;110%)</span>
        </div>
      </div>
    </div>
  );
}
