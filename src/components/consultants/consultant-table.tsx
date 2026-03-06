"use client";

import { useState, useMemo } from "react";
import { Consultant, ConsultantGroup, ConsultantBillingRole, OvertimePreference } from "@prisma/client";
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
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteConsultant } from "@/app/actions/consultants";
import { ConsultantForm } from "./consultant-form";
import { type UserOption } from "./consultants-view";

type ConsultantWithRelations = Consultant & {
  groups: ConsultantGroup[];
  billingRoles: (ConsultantBillingRole & {
    roleDefinition: { id: string; name: string };
  })[];
  manager?: { id: string; name: string } | null;
  user?: { email: string } | null;
};

interface ConsultantTableProps {
  consultants: ConsultantWithRelations[];
  users: UserOption[];
  roleDefinitions: { id: string; name: string }[];
}

const otPreferenceLabels: Record<OvertimePreference, string> = {
  NONE: "None",
  LIMITED: "Limited",
  OPEN: "Open",
};

type SortKey = "name" | "standardHours" | "overtimePreference" | "overtimeHoursAvailable" | "manager";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function ConsultantTable({ consultants, users, roleDefinitions }: ConsultantTableProps) {
  const [editingConsultant, setEditingConsultant] = useState<ConsultantWithRelations | null>(null);
  const [deletingConsultant, setDeletingConsultant] = useState<ConsultantWithRelations | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedConsultants = useMemo(() => {
    if (!sortKey) return consultants;
    return [...consultants].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "standardHours":
          cmp = a.standardHours - b.standardHours;
          break;
        case "overtimePreference":
          cmp = a.overtimePreference.localeCompare(b.overtimePreference);
          break;
        case "overtimeHoursAvailable":
          cmp = a.overtimeHoursAvailable - b.overtimeHoursAvailable;
          break;
        case "manager":
          cmp = (a.manager?.name ?? "").localeCompare(b.manager?.name ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [consultants, sortKey, sortDir]);

  const handleDelete = async () => {
    if (!deletingConsultant) return;

    setIsDeleting(true);
    try {
      await deleteConsultant(deletingConsultant.id);
      setDeletingConsultant(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                <span className="flex items-center gap-1">Name <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Billing Roles</TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("standardHours")}>
                <span className="flex items-center justify-end gap-1">Std Hours <SortIcon col="standardHours" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("overtimePreference")}>
                <span className="flex items-center gap-1">OT Pref <SortIcon col="overtimePreference" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("overtimeHoursAvailable")}>
                <span className="flex items-center justify-end gap-1">OT Hours <SortIcon col="overtimeHoursAvailable" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("manager")}>
                <span className="flex items-center gap-1">Manager <SortIcon col="manager" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedConsultants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No consultants found
                </TableCell>
              </TableRow>
            ) : (
              sortedConsultants.map((consultant) => (
                <TableRow key={consultant.id}>
                  <TableCell className="font-medium">
                    <div>
                      {consultant.name}
                      {consultant.user && (
                        <p className="text-xs text-muted-foreground">{consultant.user.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {consultant.groups.map((g) => (
                        <Badge key={g.id} variant="outline" className="text-xs">
                          {g.group}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {consultant.billingRoles.map((br) => (
                        <Badge key={br.id} variant="secondary" className="text-xs">
                          {br.roleDefinition.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{consultant.standardHours}</TableCell>
                  <TableCell>{otPreferenceLabels[consultant.overtimePreference]}</TableCell>
                  <TableCell className="text-right">{consultant.overtimeHoursAvailable}</TableCell>
                  <TableCell className="text-muted-foreground">{consultant.manager?.name || "-"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingConsultant(consultant)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingConsultant(consultant)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConsultantForm
        consultant={editingConsultant}
        open={!!editingConsultant}
        onOpenChange={(open) => !open && setEditingConsultant(null)}
        users={users}
        roleDefinitions={roleDefinitions}
      />

      <AlertDialog open={!!deletingConsultant} onOpenChange={(open) => !open && setDeletingConsultant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Consultant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingConsultant?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteError(null)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
