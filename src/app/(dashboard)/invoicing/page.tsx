import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjects } from "@/app/actions/projects";
import { InvoicingClient } from "@/components/invoicing/invoicing-client";

export default async function InvoicingPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoicing</h1>
        <p className="text-muted-foreground">
          Manage billing periods, invoice details, and project financials.
        </p>
      </div>
      <InvoicingClient projects={projects} />
    </div>
  );
}
