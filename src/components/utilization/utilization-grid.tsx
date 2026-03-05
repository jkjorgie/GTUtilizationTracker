"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { format, parseISO, addWeeks } from "date-fns";
import { AllocationEntryType, ProjectType } from "@prisma/client";
import { UtilizationData, getUtilizationData } from "@/app/actions/utilization";
import { groupWeeksByMonth, getFirstFullWeekOfMonth } from "@/lib/utils";
import { WeekCell, ProjectWeekCell, type DisplayMode } from "./week-cell";
import { GridFilters } from "./grid-filters";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface UtilizationGridProps {
  initialData: UtilizationData;
  projects: Array<{ id: string; projectName: string; timecode: string; type: ProjectType }>;
  roleDefinitions: Array<{ id: string; name: string; msrpRate: number }>;
  userRole: string;
  currentConsultantId?: string | null;
}

export function UtilizationGrid({
  initialData,
  projects,
  roleDefinitions,
  userRole,
  currentConsultantId
}: UtilizationGridProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<UtilizationData>(initialData);
  
  const defaultStart = getFirstFullWeekOfMonth();
  const defaultEnd = addWeeks(defaultStart, 13);
  
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("all");

  const [expandedConsultants, setExpandedConsultants] = useState<Set<string>>(new Set());

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

  const weekDates = useMemo(
    () => data.weeks.map((w) => parseISO(w)),
    [data.weeks]
  );
  
  const monthGroups = useMemo(
    () => groupWeeksByMonth(weekDates),
    [weekDates]
  );

  const filteredConsultants = useMemo(() => {
    const filtered = data.consultants.filter((consultant) => {
      if (roleFilter !== "all" && !consultant.roles.includes(roleFilter)) {
        return false;
      }
      if (groupFilter !== "all" && !consultant.groups.includes(groupFilter)) {
        return false;
      }
      if (searchFilter && !consultant.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      if (projectFilter.length > 0) {
        const consultantProjects = data.consultantProjects[consultant.id] || [];
        if (!consultantProjects.some(p => projectFilter.includes(p.timecode))) {
          return false;
        }
      }
      return true;
    });

    // Sort: primary = first group (alphabetical), secondary = manager name, tertiary = consultant name
    return filtered.sort((a, b) => {
      const groupA = [...a.groups].sort()[0] ?? "";
      const groupB = [...b.groups].sort()[0] ?? "";
      if (groupA !== groupB) return groupA.localeCompare(groupB);

      const managerA = a.managerName ?? "";
      const managerB = b.managerName ?? "";
      if (managerA !== managerB) return managerA.localeCompare(managerB);

      return a.name.localeCompare(b.name);
    });
  }, [data.consultants, data.consultantProjects, roleFilter, groupFilter, searchFilter, projectFilter]);

  const getCellDetails = useCallback(
    (consultantId: string, week: string) => {
      return data.allocations[consultantId]?.[week]?.details || [];
    },
    [data.allocations]
  );

  // To restore employee self-editing, replace the body with:
  //   if (userRole === "ADMIN" || userRole === "MANAGER") return true;
  //   return consultantId === currentConsultantId;
  const canEdit = useCallback(
    (_consultantId: string) => userRole === "ADMIN" || userRole === "MANAGER",
    [userRole]
  );

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

  const allExpanded = filteredConsultants.length > 0 &&
    filteredConsultants.every(c => expandedConsultants.has(c.id));

  const handleToggleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedConsultants(new Set());
    } else {
      setExpandedConsultants(new Set(filteredConsultants.map(c => c.id)));
    }
  }, [allExpanded, filteredConsultants]);

  const toggleConsultant = useCallback((consultantId: string) => {
    setExpandedConsultants(prev => {
      const next = new Set(prev);
      if (next.has(consultantId)) {
        next.delete(consultantId);
      } else {
        next.add(consultantId);
      }
      return next;
    });
  }, []);

  const updateLocalAllocations = useCallback((
    consultantId: string,
    week: string,
    projectUpdates: Array<{
      projectId: string;
      projectName: string;
      timecode: string;
      projectType: ProjectType;
      projectedHours: number;
      actualHours: number;
      notes?: string | null;
    }>,
    replaceAll: boolean
  ) => {
    setData(prev => {
      const newAllocations = { ...prev.allocations };
      const consultantAllocs = { ...newAllocations[consultantId] };
      const weekData = consultantAllocs[week]
        ? { ...consultantAllocs[week] }
        : { actual: 0, projected: 0, details: [] as typeof prev.allocations[string][string]['details'] };

      let newDetails: typeof weekData.details;
      if (replaceAll) {
        newDetails = [];
      } else {
        const updatedProjectIds = new Set(projectUpdates.map(u => u.projectId));
        newDetails = weekData.details.filter(d => !updatedProjectIds.has(d.projectId));
      }

      for (const update of projectUpdates) {
        if (update.projectedHours > 0) {
          newDetails.push({
            projectId: update.projectId,
            projectName: update.projectName,
            timecode: update.timecode,
            projectType: update.projectType,
            hours: update.projectedHours,
            entryType: AllocationEntryType.PROJECTED,
            notes: update.notes ?? null,
            createdBy: null,
            updatedAt: new Date(),
          });
        }
        if (update.actualHours > 0) {
          newDetails.push({
            projectId: update.projectId,
            projectName: update.projectName,
            timecode: update.timecode,
            projectType: update.projectType,
            hours: update.actualHours,
            entryType: AllocationEntryType.ACTUAL,
            notes: update.notes ?? null,
            createdBy: null,
            updatedAt: new Date(),
          });
        }
      }

      weekData.details = newDetails;
      weekData.actual = newDetails
        .filter(d => d.entryType === AllocationEntryType.ACTUAL)
        .reduce((sum, d) => sum + d.hours, 0);
      weekData.projected = newDetails
        .filter(d => d.entryType === AllocationEntryType.PROJECTED)
        .reduce((sum, d) => sum + d.hours, 0);

      consultantAllocs[week] = weekData;
      newAllocations[consultantId] = consultantAllocs;
      return { ...prev, allocations: newAllocations };
    });
  }, []);

  return (
    <div className="space-y-4">
      <GridFilters
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
        allExpanded={allExpanded}
        onToggleExpandAll={handleToggleExpandAll}
        projects={projects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
      />

      {/* Display mode toggle */}
      <div className="flex gap-1 flex-wrap">
        {([
          { value: "all",       label: "All Hours" },
          { value: "billable",  label: "Billable + Assigned" },
          { value: "available", label: "Available Hours" },
          { value: "variance",  label: "Actual vs Projected" },
        ] as { value: DisplayMode; label: string }[]).map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant={displayMode === value ? "default" : "outline"}
            onClick={() => setDisplayMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="border rounded-lg overflow-x-auto relative">
        {isPending && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
          <div className="min-w-max">
            {/* Header Row 1: Months */}
            <div className="flex border-b bg-muted/50">
              <div className="w-64 min-w-64 p-2 border-r font-medium text-sm sticky left-0 bg-muted/50 z-20">
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
              <div className="w-64 min-w-64 p-2 border-r sticky left-0 bg-muted/30 z-20" />
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
              filteredConsultants.map((consultant) => {
                const isExpanded = expandedConsultants.has(consultant.id);
                const allConsultantProjects = data.consultantProjects[consultant.id] || [];
                const consultantProjectsList = projectFilter.length > 0
                  ? allConsultantProjects.filter(p => projectFilter.includes(p.timecode))
                  : allConsultantProjects;

                return (
                  <div key={consultant.id}>
                    {/* Summary Row */}
                    <div className="flex border-b hover:bg-muted/20">
                      {/* Name column with expand toggle */}
                      <div className="w-64 min-w-64 p-2 border-r sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleConsultant(consultant.id)}
                            className="p-0.5 hover:bg-muted rounded shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <span className="font-medium text-sm truncate">
                            {consultant.name}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-1 pl-5">
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
                            displayMode={displayMode}
                            projects={projects}
                            roleDefinitions={roleDefinitions.filter((rd) =>
                              consultant.billingRoleIds.includes(rd.id)
                            )}
                            onSave={(allocations) => {
                              updateLocalAllocations(
                                consultant.id,
                                week,
                                allocations.map(a => {
                                  const proj = projects.find(p => p.id === a.projectId);
                                  return {
                                    projectId: a.projectId,
                                    projectName: proj?.projectName ?? '',
                                    timecode: proj?.timecode ?? '',
                                    projectType: proj?.type ?? ProjectType.BILLABLE,
                                    projectedHours: a.projectedHours,
                                    actualHours: a.actualHours,
                                    notes: a.notes,
                                  };
                                }),
                                true
                              );
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Expanded Project Rows */}
                    {isExpanded && consultantProjectsList.map((project) => {
                      const editable = canEdit(consultant.id);
                      return (
                        <div key={project.projectId} className="flex border-b bg-muted/5">
                          {/* Project name column */}
                          <div className="w-64 min-w-64 px-2 py-1.5 border-r sticky left-0 bg-muted/5 z-10 flex items-center">
                            <span className="text-xs text-muted-foreground pl-5 truncate">
                              {project.timecode} - {project.projectName}
                            </span>
                          </div>

                          {/* Project week cells */}
                          {data.weeks.map((week) => {
                            const details = getCellDetails(consultant.id, week);
                            const projectDetails = details.filter(d => d.projectId === project.projectId);
                            const projected = projectDetails
                              .filter(d => d.entryType === AllocationEntryType.PROJECTED)
                              .reduce((sum, d) => sum + d.hours, 0);
                            const actual = projectDetails
                              .filter(d => d.entryType === AllocationEntryType.ACTUAL)
                              .reduce((sum, d) => sum + d.hours, 0);
                            const notes = projectDetails.find(d => d.notes)?.notes ?? null;

                            return (
                              <ProjectWeekCell
                                key={week}
                                consultantId={consultant.id}
                                consultantName={consultant.name}
                                week={week}
                                projected={projected}
                                actual={actual}
                                notes={notes}
                                projectId={project.projectId}
                                projectName={project.projectName}
                                timecode={project.timecode}
                                editable={editable}
                                onSave={(projectedHours, actualHours, notes) => {
                                  updateLocalAllocations(
                                    consultant.id,
                                    week,
                                    [{
                                      projectId: project.projectId,
                                      projectName: project.projectName,
                                      timecode: project.timecode,
                                      projectType: projects.find(p => p.id === project.projectId)?.type ?? ProjectType.BILLABLE,
                                      projectedHours,
                                      actualHours,
                                      notes,
                                    }],
                                    false
                                  );
                                }}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        
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
        <div className="flex items-center gap-2 ml-4 border-l pl-4">
          <div className="w-6 h-4 relative border rounded overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 24 16" preserveAspectRatio="none">
              <line x1="24" y1="0" x2="0" y2="16" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="absolute top-0 left-0.5 text-[6px] leading-none">P</span>
            <span className="absolute bottom-0 right-0.5 text-[6px] leading-none">A</span>
          </div>
          <span>Past weeks: Projected / Actual</span>
        </div>
      </div>
    </div>
  );
}
