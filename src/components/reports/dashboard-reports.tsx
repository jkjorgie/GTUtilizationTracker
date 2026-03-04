"use client";

import { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Clock, DollarSign, Activity } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { getDashboardReportData, type DashboardReportData } from "@/app/actions/reports";

const TIME_RANGE_OPTIONS = [
  { label: "Last 4 weeks", weeksBack: 4, weeksForward: 1 },
  { label: "Last 8 weeks", weeksBack: 8, weeksForward: 2 },
  { label: "Last 13 weeks", weeksBack: 12, weeksForward: 4 },
  { label: "Last 26 weeks", weeksBack: 26, weeksForward: 8 },
];

interface DashboardReportsProps {
  initialData: DashboardReportData;
  userRole: UserRole;
}

export function DashboardReports({ initialData, userRole }: DashboardReportsProps) {
  const [data, setData] = useState<DashboardReportData>(initialData);
  const [rangeKey, setRangeKey] = useState("2");
  const [isPending, startTransition] = useTransition();

  function handleRangeChange(key: string) {
    setRangeKey(key);
    const opt = TIME_RANGE_OPTIONS[parseInt(key)];
    startTransition(async () => {
      const fresh = await getDashboardReportData({
        weeksBack: opt.weeksBack,
        weeksForward: opt.weeksForward,
      });
      setData(fresh);
    });
  }

  const isAdmin = userRole === "ADMIN";
  const isManagerOrAdmin = userRole === "ADMIN" || userRole === "MANAGER";

  return (
    <div className="space-y-6">
      {/* Section header + time range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">Analytics and trends for your team</p>
        </div>
        <div className="flex items-center gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Select value={rangeKey} onValueChange={handleRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((opt, i) => (
                <SelectItem key={i} value={String(i)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: Utilization Trend + Available Capacity (all users) */}
      <div className="grid gap-4 md:grid-cols-2">
        <UtilizationTrendTile data={data.utilizationTrend} isPending={isPending} />
        <AvailableCapacityTile data={data.availableCapacity} isPending={isPending} />
      </div>

      {/* Row 2: Admin + Manager tiles */}
      {isManagerOrAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BillableActualsTile data={data.billableActuals} isPending={isPending} />
          <ProjectHealthTile data={data.projectHealth} isPending={isPending} />
          <UpcomingPTOTile data={data.upcomingPTO} isPending={isPending} />
        </div>
      )}

      {/* Row 3: PTO for employees (standalone) */}
      {!isManagerOrAdmin && (
        <div className="grid gap-4 md:grid-cols-1 max-w-md">
          <UpcomingPTOTile data={data.upcomingPTO} isPending={isPending} />
        </div>
      )}

      {/* Row 4: Admin-only financial tiles */}
      {isAdmin && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <RevenueForecastTile data={data.revenueForecast} isPending={isPending} />
            <TrainingCostsTile
              data={data.trainingHours}
              timecodes={data.trainingTimecodes}
              isPending={isPending}
            />
            <OverheadCostsTile
              data={data.overheadHours}
              timecodes={data.overheadTimecodes}
              isPending={isPending}
            />
          </div>
          <ProjectBudgetTile data={data.projectBudgets} isPending={isPending} />
        </>
      )}
    </div>
  );
}

// ─── Individual Tiles ────────────────────────────────────────────────────────

function UtilizationTrendTile({
  data,
  isPending,
}: {
  data: DashboardReportData["utilizationTrend"];
  isPending: boolean;
}) {
  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Utilization Trend</CardTitle>
        </div>
        <CardDescription>Projected vs actual hours by week</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
              name="Projected"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function AvailableCapacityTile({
  data,
  isPending,
}: {
  data: DashboardReportData["availableCapacity"];
  isPending: boolean;
}) {
  const totalAvailable = data.reduce((s, d) => s + d.available, 0);

  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Available Capacity</CardTitle>
        </div>
        <CardDescription>
          Unallocated hours — current week and beyond
          {data.length > 0 && (
            <span className="ml-1 font-medium text-foreground">
              ({totalAvailable.toLocaleString()} hrs total)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            No upcoming weeks
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
              <Bar dataKey="standard" fill="#e2e8f0" name="Standard" radius={[2, 2, 0, 0]} />
              <Bar dataKey="available" fill="#22c55e" name="Available" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function BillableActualsTile({
  data,
  isPending,
}: {
  data: DashboardReportData["billableActuals"];
  isPending: boolean;
}) {
  const total = data.reduce((s, d) => s + d.hours, 0);

  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Billable Actuals</CardTitle>
        </div>
        <CardDescription>
          Actual hours on billable projects
          <span className="ml-1 font-medium text-foreground">
            ({total.toLocaleString()} hrs)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
            <Bar dataKey="hours" fill="#3b82f6" name="Billable Hours" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ProjectHealthTile({
  data,
  isPending,
}: {
  data: DashboardReportData["projectHealth"];
  isPending: boolean;
}) {
  const total = data.red + data.yellow + data.green + data.none;

  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Project Health</CardTitle>
        <CardDescription>Active projects by status ({total} total)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <HealthKPI count={data.green} label="On Track" color="bg-green-500" />
          <HealthKPI count={data.yellow} label="At Risk" color="bg-yellow-500" />
          <HealthKPI count={data.red} label="Off Track" color="bg-red-500" />
          <HealthKPI count={data.none} label="No Status" color="bg-slate-300" />
        </div>
      </CardContent>
    </Card>
  );
}

function HealthKPI({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
      <div className={`h-3 w-3 rounded-full flex-shrink-0 ${color}`} />
      <div>
        <p className="text-2xl font-bold leading-none">{count}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function UpcomingPTOTile({
  data,
  isPending,
}: {
  data: DashboardReportData["upcomingPTO"];
  isPending: boolean;
}) {
  const total = data.reduce((s, d) => s + d.hours, 0);

  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Upcoming PTO Impact</CardTitle>
        <CardDescription>
          Approved PTO hours ahead
          <span className="ml-1 font-medium text-foreground">
            ({total.toLocaleString()} hrs)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
            No upcoming approved PTO
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
              <Bar dataKey="hours" fill="#f97316" name="PTO Hours" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueForecastTile({
  data,
  isPending,
}: {
  data: DashboardReportData["revenueForecast"];
  isPending: boolean;
}) {
  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Revenue Forecast</CardTitle>
        </div>
        <CardDescription>Projected MSRP from current week forward</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-1">
          <p className="text-3xl font-bold">
            ${data.upcomingMsrp.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            across ~{data.periodCount} billing period{data.periodCount !== 1 ? "s" : ""}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Based on projected hours × MSRP rates for active billable projects. Does not apply sales discount.
        </p>
      </CardContent>
    </Card>
  );
}

function TrainingCostsTile({
  data,
  timecodes,
  isPending,
}: {
  data: DashboardReportData["trainingHours"];
  timecodes: string[];
  isPending: boolean;
}) {
  const total = data.reduce((s, d) => s + d.hours, 0);

  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Training Hours</CardTitle>
        <CardDescription>
          Hours on training projects
          <span className="ml-1 font-medium text-foreground">({total} hrs)</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {timecodes.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground text-center px-4">
            No training timecodes configured.{" "}
            <a href="/settings" className="underline ml-1">
              Add them in Settings.
            </a>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                <Bar dataKey="hours" fill="#a855f7" name="Hours" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-1 mt-2">
              {timecodes.map((tc) => (
                <Badge key={tc} variant="secondary" className="text-xs">
                  {tc}
                </Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OverheadCostsTile({
  data,
  timecodes,
  isPending,
}: {
  data: DashboardReportData["overheadHours"];
  timecodes: string[];
  isPending: boolean;
}) {
  const total = data.reduce((s, d) => s + d.hours, 0);

  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Overhead Hours</CardTitle>
        <CardDescription>
          Hours on overhead projects
          <span className="ml-1 font-medium text-foreground">({total} hrs)</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {timecodes.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground text-center px-4">
            No overhead timecodes configured.{" "}
            <a href="/settings" className="underline ml-1">
              Add them in Settings.
            </a>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                <Bar dataKey="hours" fill="#ec4899" name="Hours" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-1 mt-2">
              {timecodes.map((tc) => (
                <Badge key={tc} variant="secondary" className="text-xs">
                  {tc}
                </Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectBudgetTile({
  data,
  isPending,
}: {
  data: DashboardReportData["projectBudgets"];
  isPending: boolean;
}) {
  const healthColor = (health: string | null) => {
    if (health === "GREEN") return "bg-green-500";
    if (health === "YELLOW") return "bg-yellow-500";
    if (health === "RED") return "bg-red-500";
    return "bg-slate-300";
  };

  return (
    <Card className={isPending ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Project Budget Overview</CardTitle>
        <CardDescription>Active projects — budget and actual hours to date</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No active projects</p>
        ) : (
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left pb-2 font-medium">Project</th>
                  <th className="text-left pb-2 font-medium">Client</th>
                  <th className="text-right pb-2 font-medium">Budget</th>
                  <th className="text-right pb-2 font-medium">Actual Hrs</th>
                  <th className="text-center pb-2 font-medium">Health</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.timecode} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{p.timecode}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {p.projectName}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground truncate max-w-[100px]">
                      {p.client}
                    </td>
                    <td className="py-2 text-right">
                      {p.budget != null ? `$${p.budget.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 text-right">{p.totalActualHours.toLocaleString()}</td>
                    <td className="py-2 text-center">
                      <div
                        className={`h-2.5 w-2.5 rounded-full mx-auto ${healthColor(p.health)}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
