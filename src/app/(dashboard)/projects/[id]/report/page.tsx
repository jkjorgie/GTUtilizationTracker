import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectReports, getProjectReportContext } from "@/app/actions/project-reports";
import { ProjectReportView } from "@/components/projects/project-report-view";

export default async function ProjectReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;

  const [projectContext, reports] = await Promise.all([
    getProjectReportContext(id),
    getProjectReports(id),
  ]);

  return (
    <ProjectReportView
      projectContext={projectContext}
      reports={reports}
    />
  );
}
