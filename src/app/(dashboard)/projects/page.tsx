import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjects, getPEMConsultants } from "@/app/actions/projects";
import { getRoleDefinitions } from "@/app/actions/roles";
import { getAllConsultants } from "@/app/actions/consultants";
import { ProjectsView } from "@/components/projects/projects-view";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [projects, pemConsultants, roleDefinitions, allConsultants] = await Promise.all([
    getProjects(),
    getPEMConsultants(),
    getRoleDefinitions(),
    getAllConsultants(),
  ]);

  return (
    <div className="space-y-6">
      <ProjectsView
        projects={projects}
        pemConsultants={pemConsultants}
        roleDefinitions={roleDefinitions}
        allConsultants={allConsultants}
      />
    </div>
  );
}
