"use client";

import { useState } from "react";
import { format } from "date-fns";
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Check, X, Trash2 } from "lucide-react";
import { approvePTORequest, denyPTORequest, deletePTORequest } from "@/app/actions/pto";

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
};

export function PTOList({ ptoRequests, userRole, currentConsultantId }: PTOListProps) {
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canManage = userRole === "ADMIN" || userRole === "MANAGER";

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

  const handleDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    setError(null);
    try {
      await deletePTORequest(deleteId);
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
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
              <TableHead>Employee</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approved By</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ptoRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No PTO requests found
                </TableCell>
              </TableRow>
            ) : (
              ptoRequests.map((pto) => {
                const canDelete = pto.status === "PENDING" && 
                  (canManage || pto.consultantId === currentConsultantId);
                const canAction = canManage && pto.status === "PENDING";

                return (
                  <TableRow key={pto.id}>
                    <TableCell className="font-medium">{pto.consultant.name}</TableCell>
                    <TableCell>{format(new Date(pto.startDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(new Date(pto.endDate), "MMM d, yyyy")}</TableCell>
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
                        {pto.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {pto.approvedBy?.email || "-"}
                    </TableCell>
                    <TableCell>
                      {(canAction || canDelete) && (
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
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => setDeleteId(pto.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete PTO Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this PTO request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
