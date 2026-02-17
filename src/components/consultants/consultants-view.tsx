"use client";

import { useState, useMemo } from "react";
import { Consultant, ConsultantGroup, ConsultantRole, GroupType, RoleLevel } from "@prisma/client";
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
import { ConsultantForm } from "./consultant-form";
import { ConsultantTable } from "./consultant-table";
import { Plus, Search } from "lucide-react";

type ConsultantWithRelations = Consultant & {
  groups: ConsultantGroup[];
  roles: ConsultantRole[];
  user?: { email: string } | null;
};

interface ConsultantsViewProps {
  consultants: ConsultantWithRelations[];
}

const groupOptions = [
  { value: GroupType.TECH, label: "Tech" },
  { value: GroupType.FABA, label: "FA/BA" },
  { value: GroupType.PEM, label: "PEM" },
  { value: GroupType.SA, label: "SA" },
];

const roleOptions = [
  { value: RoleLevel.T1, label: "T1" },
  { value: RoleLevel.T2, label: "T2" },
  { value: RoleLevel.T3, label: "T3" },
  { value: RoleLevel.STA, label: "STA" },
  { value: RoleLevel.PTA, label: "PTA" },
  { value: RoleLevel.LTA, label: "LTA" },
  { value: RoleLevel.FA1, label: "FA1" },
  { value: RoleLevel.FA2, label: "FA2" },
  { value: RoleLevel.FA3, label: "FA3" },
  { value: RoleLevel.SBA, label: "SBA" },
  { value: RoleLevel.PBA, label: "PBA" },
  { value: RoleLevel.LBA, label: "LBA" },
  { value: RoleLevel.EM1, label: "EM1" },
  { value: RoleLevel.EM2, label: "EM2" },
  { value: RoleLevel.EM3, label: "EM3" },
  { value: RoleLevel.PM, label: "PM" },
];

export function ConsultantsView({ consultants }: ConsultantsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Client-side filtering - instant, no debounce needed
  const filteredConsultants = useMemo(() => {
    return consultants.filter((consultant) => {
      // Group filter
      if (groupFilter !== "all" && !consultant.groups.some(g => g.group === groupFilter)) {
        return false;
      }
      // Role filter
      if (roleFilter !== "all" && !consultant.roles.some(r => r.level === roleFilter)) {
        return false;
      }
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        return consultant.name.toLowerCase().includes(searchLower);
      }
      return true;
    });
  }, [consultants, groupFilter, roleFilter, search]);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Consultants</h1>
          <p className="text-muted-foreground">Manage consultant records and availability</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Consultant
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groupOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Consultants ({filteredConsultants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsultantTable consultants={filteredConsultants} />
        </CardContent>
      </Card>

      <ConsultantForm open={showForm} onOpenChange={setShowForm} />
    </>
  );
}
