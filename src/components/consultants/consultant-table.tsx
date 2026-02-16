"use client";

import { useState } from "react";
import { Consultant, ConsultantGroup, ConsultantRole, OvertimePreference } from "@prisma/client";
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteConsultant } from "@/app/actions/consultants";
import { ConsultantForm } from "./consultant-form";

type ConsultantWithRelations = Consultant & {
  groups: ConsultantGroup[];
  roles: ConsultantRole[];
  user?: { email: string } | null;
};

interface ConsultantTableProps {
  consultants: ConsultantWithRelations[];
}

const otPreferenceLabels: Record<OvertimePreference, string> = {
  NONE: "None",
  LIMITED: "Limited",
  OPEN: "Open",
};

export function ConsultantTable({ consultants }: ConsultantTableProps) {
  const [editingConsultant, setEditingConsultant] = useState<ConsultantWithRelations | null>(null);
  const [deletingConsultant, setDeletingConsultant] = useState<ConsultantWithRelations | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingConsultant) return;

    try {
      await deleteConsultant(deletingConsultant.id);
      setDeletingConsultant(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Std Hours</TableHead>
              <TableHead>OT Pref</TableHead>
              <TableHead className="text-right">OT Hours</TableHead>
              <TableHead>HR Manager</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consultants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No consultants found
                </TableCell>
              </TableRow>
            ) : (
              consultants.map((consultant) => (
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
                      {consultant.roles.map((r) => (
                        <Badge key={r.id} variant="secondary" className="text-xs">
                          {r.level.replace("LVL", "L")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{consultant.standardHours}</TableCell>
                  <TableCell>{otPreferenceLabels[consultant.overtimePreference]}</TableCell>
                  <TableCell className="text-right">{consultant.overtimeHoursAvailable}</TableCell>
                  <TableCell className="text-muted-foreground">{consultant.hrManager || "-"}</TableCell>
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
            <AlertDialogCancel onClick={() => setDeleteError(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
