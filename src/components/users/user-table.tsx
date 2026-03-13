"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { UserRole } from "@prisma/client";
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
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Pencil, Trash2, KeyRound, Check, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { deleteUser, resetUserPassword, setRequirePasswordReset } from "@/app/actions/users";
import { resetUserTotp } from "@/app/actions/totp";
import { UserForm } from "./user-form";
import { PASSWORD_REQUIREMENTS } from "@/lib/password-validation";

type UserWithConsultant = {
  id: string;
  email: string;
  role: UserRole;
  requirePasswordReset: boolean;
  consultant: { id: string; name: string } | null;
  createdAt: Date;
};

type ConsultantForLinking = {
  id: string;
  name: string;
  user: { id: string } | null;
};

interface UserTableProps {
  users: UserWithConsultant[];
  consultants: ConsultantForLinking[];
  currentUserId: string;
  totpStatus: Record<string, boolean>;
}

const roleColors: Record<UserRole, string> = {
  ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  EMPLOYEE: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200",
};

type SortKey = "email" | "role" | "consultant" | "createdAt";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function UserTable({ users, consultants, currentUserId, totpStatus }: UserTableProps) {
  const [editingUser, setEditingUser] = useState<{
    id: string;
    email: string;
    role: UserRole;
    consultantId: string | null;
  } | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithConsultant | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithConsultant | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [togglingResetFor, setTogglingResetFor] = useState<string | null>(null);
  const [resettingTotpFor, setResettingTotpFor] = useState<string | null>(null);
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

  const sortedUsers = useMemo(() => {
    if (!sortKey) return users;
    return [...users].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "role":
          cmp = a.role.localeCompare(b.role);
          break;
        case "consultant":
          cmp = (a.consultant?.name ?? "").localeCompare(b.consultant?.name ?? "");
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  const handleDelete = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;

    setIsResetting(true);
    setError(null);
    try {
      await resetUserPassword(resetPasswordUser.id, newPassword);
      setResetSuccess(true);
      setTimeout(() => {
        setResetPasswordUser(null);
        setNewPassword("");
        setResetSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetTotp = async (userId: string) => {
    setResettingTotpFor(userId);
    try {
      await resetUserTotp(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset 2FA");
    } finally {
      setResettingTotpFor(null);
    }
  };

  const handleToggleForceReset = async (user: UserWithConsultant) => {
    setTogglingResetFor(user.id);
    try {
      await setRequirePasswordReset(user.id, !user.requirePasswordReset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setTogglingResetFor(null);
    }
  };

  const handleEditClick = (user: UserWithConsultant) => {
    setEditingUser({
      id: user.id,
      email: user.email,
      role: user.role,
      consultantId: user.consultant?.id || null,
    });
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("email")}>
                <span className="flex items-center gap-1">Email <SortIcon col="email" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("role")}>
                <span className="flex items-center gap-1">Role <SortIcon col="role" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("consultant")}>
                <span className="flex items-center gap-1">Linked Consultant <SortIcon col="consultant" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("createdAt")}>
                <span className="flex items-center gap-1">Created <SortIcon col="createdAt" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.email}
                    {user.id === currentUserId && (
                      <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                    )}
                    {user.requirePasswordReset && (
                      <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-400">
                        Reset Required
                      </Badge>
                    )}
                    {totpStatus[user.id] && (
                      <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-400">
                        2FA
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={roleColors[user.role]}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.consultant?.name || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setResetPasswordUser(user);
                          setNewPassword("");
                          setError(null);
                          setResetSuccess(false);
                        }}>
                          <KeyRound className="mr-2 h-4 w-4" />
                          Reset Password
                        </DropdownMenuItem>
                        {user.id !== currentUserId && (
                          <DropdownMenuItem
                            onClick={() => handleToggleForceReset(user)}
                            disabled={togglingResetFor === user.id}
                          >
                            {user.requirePasswordReset ? (
                              <>
                                <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
                                Clear Reset Requirement
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="mr-2 h-4 w-4 text-amber-600" />
                                Require Password Reset
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        {user.id !== currentUserId && totpStatus[user.id] && (
                          <DropdownMenuItem
                            onClick={() => handleResetTotp(user.id)}
                            disabled={resettingTotpFor === user.id}
                          >
                            <Smartphone className="mr-2 h-4 w-4 text-muted-foreground" />
                            Reset 2FA
                          </DropdownMenuItem>
                        )}
                        {user.id !== currentUserId && (
                          <DropdownMenuItem
                            onClick={() => setDeletingUser(user)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Form */}
      <UserForm
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        consultants={consultants}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user &quot;{deletingUser?.email}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setError(null)} disabled={isDeleting}>
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

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => {
        if (!open) {
          setResetPasswordUser(null);
          setNewPassword("");
          setError(null);
          setResetSuccess(false);
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordUser?.email}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {error}
            </div>
          )}

          {resetSuccess && (
            <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md flex items-center gap-2">
              <Check className="h-4 w-4" />
              Password reset successfully!
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={resetSuccess}
            />
            <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordUser(null)} disabled={isResetting}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isResetting || !newPassword || newPassword.length < 16 || resetSuccess}
            >
              {isResetting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
