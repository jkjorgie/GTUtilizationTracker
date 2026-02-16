"use client";

import { useState, useMemo } from "react";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserForm } from "./user-form";
import { UserTable } from "./user-table";
import { Plus, Search } from "lucide-react";

type UserWithConsultant = {
  id: string;
  email: string;
  role: UserRole;
  consultant: { id: string; name: string } | null;
  createdAt: Date;
};

type ConsultantForLinking = {
  id: string;
  name: string;
  user: { id: string } | null;
};

interface UsersViewProps {
  users: UserWithConsultant[];
  consultants: ConsultantForLinking[];
  currentUserId: string;
}

export function UsersView({ users, consultants, currentUserId }: UsersViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Client-side filtering - instant
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Role filter
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          user.email.toLowerCase().includes(searchLower) ||
          user.consultant?.name.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [users, roleFilter, search]);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
            <SelectItem value={UserRole.MANAGER}>Manager</SelectItem>
            <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <UserTable 
            users={filteredUsers} 
            consultants={consultants}
            currentUserId={currentUserId}
          />
        </CardContent>
      </Card>

      <UserForm 
        open={showForm} 
        onOpenChange={setShowForm} 
        consultants={consultants}
      />
    </>
  );
}
