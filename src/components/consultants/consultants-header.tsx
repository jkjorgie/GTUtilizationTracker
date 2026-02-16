"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConsultantForm } from "./consultant-form";
import { Plus, Search } from "lucide-react";
import { GroupType, RoleLevel } from "@prisma/client";

const groupOptions = [
  { value: GroupType.SA, label: "SA" },
  { value: GroupType.BA, label: "BA" },
  { value: GroupType.TECH, label: "Tech" },
  { value: GroupType.UX, label: "UX" },
  { value: GroupType.AI, label: "AI" },
];

const roleOptions = [
  { value: RoleLevel.LVL2, label: "Level 2" },
  { value: RoleLevel.LVL3, label: "Level 3" },
  { value: RoleLevel.LVL4, label: "Level 4" },
  { value: RoleLevel.LVL5, label: "Level 5" },
  { value: RoleLevel.LEAD, label: "Lead" },
];

export function ConsultantsHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/consultants?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("search", search || null);
  };

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
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" size="icon" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex gap-2">
          <Select
            value={searchParams.get("group") || "all"}
            onValueChange={(value) => updateFilter("group", value)}
          >
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

          <Select
            value={searchParams.get("role") || "all"}
            onValueChange={(value) => updateFilter("role", value)}
          >
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

      <ConsultantForm
        open={showForm}
        onOpenChange={setShowForm}
      />
    </>
  );
}
