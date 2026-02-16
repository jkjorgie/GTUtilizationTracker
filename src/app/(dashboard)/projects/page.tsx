import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjects } from "@/app/actions/projects";
import { ProjectsView } from "@/components/projects/projects-view";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch all projects - filtering is done client-side for instant search
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <ProjectsView projects={projects} />
    </div>
  );
}
