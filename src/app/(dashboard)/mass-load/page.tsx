import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllConsultants } from "@/app/actions/consultants";
import { getActiveProjects } from "@/app/actions/projects";
import { MassLoadForm } from "@/components/mass-load/mass-load-form";

export default async function MassLoadPage() {
  const session = await auth();
  
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/");
  }

  const [consultants, projects] = await Promise.all([
    getAllConsultants(),
    getActiveProjects(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mass Load</h1>
        <p className="text-muted-foreground">
          Bulk assign hours to multiple consultants for holidays, events, or company-wide allocations
        </p>
      </div>

      <MassLoadForm consultants={consultants} projects={projects} />
    </div>
  );
}
