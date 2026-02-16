"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PTOForm } from "./pto-form";
import { Plus } from "lucide-react";

interface PTOHeaderProps {
  consultants: Array<{ id: string; name: string }>;
  currentConsultantId?: string | null;
  isEmployee?: boolean;
}

export function PTOHeader({ consultants, currentConsultantId, isEmployee }: PTOHeaderProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">PTO Requests</h1>
          <p className="text-muted-foreground">
            {isEmployee 
              ? "Submit and track your time off requests" 
              : "Manage and approve time off requests"}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Request PTO
        </Button>
      </div>

      <PTOForm
        consultants={consultants}
        currentConsultantId={currentConsultantId}
        isEmployee={isEmployee}
        open={showForm}
        onOpenChange={setShowForm}
      />
    </>
  );
}
