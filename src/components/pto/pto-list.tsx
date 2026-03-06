"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { PTOStatus, PTORequest, Consultant, User } from "@prisma/client";
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
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Check, X, Ban } from "lucide-react";
import { approvePTORequest, denyPTORequest, cancelPTORequest } from "@/app/actions/pto";

type PTOWithRelations = PTORequest & {
  consultant: { id: string; name: string };
  approvedBy?: { id: string; email: string } | null;
};

interface PTOListProps {
  ptoRequests: PTOWithRelations[];
  userRole: string;
  currentConsultantId?: string | null;
}

const statusColors: Record<PTOStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  DENIED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

type SortKey = "employee" | "startDate" | "endDate" | "type" | "status" | "approvedBy";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function PTOList({ ptoRequests, userRole, currentConsultantId }: PTOListProps) {
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const canManage = userRole === "ADMIN" || userRole === "MANAGER";

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRequests = useMemo(() => {
    if (!sortKey) return ptoRequests;
    return [...ptoRequests].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "employee":
          cmp = a.consultant.name.localeCompare(b.consultant.name);
          break;
        case "startDate":
          cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case "endDate":
          cmp = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
        case "type":
          cmp = (a.allDay ? "All Day" : a.startTime ?? "").localeCompare(b.allDay ? "All Day" : b.startTime ?? "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "approvedBy":
          cmp = (a.approvedBy?.email ?? "").localeCompare(b.approvedBy?.email ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [ptoRequests, sortKey, sortDir]);

  const handleApprove = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await approvePTORequest(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setLoading(false);
      setActioningId(null);
    }
  };

  const handleDeny = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await denyPTORequest(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deny");
    } finally {
      setLoading(false);
      setActioningId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    setLoading(true);
    setError(null);
    try {
      await cancelPTORequest(cancelId);
      setCancelId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("employee")}>
                <span className="flex items-center gap-1">Employee <SortIcon col="employee" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("startDate")}>
                <span className="flex items-center gap-1">Start Date <SortIcon col="startDate" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("endDate")}>
                <span className="flex items-center gap-1">End Date <SortIcon col="endDate" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("type")}>
                <span className="flex items-center gap-1">Type <SortIcon col="type" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                <span className="flex items-center gap-1">Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("approvedBy")}>
                <span className="flex items-center gap-1">Approved By <SortIcon col="approvedBy" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No PTO requests found
                </TableCell>
              </TableRow>
            ) : (
              sortedRequests.map((pto) => {
                // Managers and admins can action (approve/deny) pending requests.
                // Managers only see their own + direct reports via getPTORequests,
                // so visibility implies manage permission.
                const canAction = canManage && pto.status === "PENDING";

                // Cancel is available on PENDING and APPROVED requests.
                // Employees can only cancel their own; managers/admins can cancel all they can see.
                const canCancel =
                  (pto.status === "PENDING" || pto.status === "APPROVED") &&
                  (canManage || pto.consultantId === currentConsultantId);

                return (
                  <TableRow key={pto.id}>
                    <TableCell className="font-medium">{pto.consultant.name}</TableCell>
                    <TableCell>{format(parseISO(pto.startDate.toISOString().split("T")[0]), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(parseISO(pto.endDate.toISOString().split("T")[0]), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {pto.allDay ? (
                        "All Day"
                      ) : (
                        <span className="text-sm">
                          {pto.startTime} - {pto.endTime}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[pto.status]}>
                        {pto.status.charAt(0) + pto.status.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {pto.approvedBy?.email || "-"}
                    </TableCell>
                    <TableCell>
                      {(canAction || canCancel) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={loading}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canAction && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleApprove(pto.id)}
                                  className="text-green-600"
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeny(pto.id)}
                                  className="text-red-600"
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Deny
                                </DropdownMenuItem>
                              </>
                            )}
                            {canCancel && (
                              <DropdownMenuItem
                                onClick={() => setCancelId(pto.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel PTO Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this PTO request? If it was already approved, the
              time will be removed from the utilization grid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Back</AlertDialogCancel>
            <Button onClick={handleCancel} disabled={loading} variant="destructive">
              {loading ? "Cancelling..." : "Cancel Request"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
