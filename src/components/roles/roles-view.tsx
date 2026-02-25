"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { updateRoleDefinition } from "@/app/actions/roles";

interface RoleDefinition {
  id: string;
  name: string;
  msrpRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface RolesViewProps {
  roles: RoleDefinition[];
}

export function RolesView({ roles: initialRoles }: RolesViewProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = useCallback((role: RoleDefinition) => {
    setEditingRole(role);
    setEditRate(role.msrpRate.toString());
    setEditActive(role.isActive);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingRole) return;

    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate < 0) {
      setError("Please enter a valid rate (0 or greater)");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateRoleDefinition(editingRole.id, {
        msrpRate: rate,
        isActive: editActive,
      });
      setRoles(prev => prev.map(r => r.id === updated.id ? { ...r, msrpRate: updated.msrpRate, isActive: updated.isActive } : r));
      setEditingRole(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [editingRole, editRate, editActive]);

  const activeCount = roles.filter(r => r.isActive).length;

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Role Setup</h1>
        <p className="text-muted-foreground">
          Define roles and MSRP rates for consultant assignments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles ({activeCount} active)</CardTitle>
          <CardDescription>
            Edit the MSRP rate and active status for each role. Only active roles can be assigned to consultants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">MSRP Rate</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id} className={!role.isActive ? "opacity-50" : ""}>
                    <TableCell>{role.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {role.msrpRate > 0
                        ? `$${role.msrpRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={
                          role.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200"
                        }
                      >
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              {editingRole?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="msrp-rate">MSRP Rate ($/hr)</Label>
              <Input
                id="msrp-rate"
                type="number"
                min="0"
                step="0.01"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="role-active">Active</Label>
              <Switch
                id="role-active"
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
