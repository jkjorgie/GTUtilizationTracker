import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { getProjectSchedule } from "@/app/actions/project-schedule";
import { ProjectScheduleView } from "@/components/projects/project-schedule-view";

export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;

  const [project, scheduleItems] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        client: true,
        projectName: true,
        startDate: true,
        endDate: true,
        projectManager: { select: { name: true } },
      },
    }),
    getProjectSchedule(id),
  ]);

  if (!project) {
    redirect("/projects");
  }

  const decryptedProject = {
    ...project,
    client: decrypt(project.client),
    projectName: decrypt(project.projectName),
    projectManager: project.projectManager
      ? { name: decrypt(project.projectManager.name) }
      : null,
  };

  return (
    <ProjectScheduleView project={decryptedProject} scheduleItems={scheduleItems} />
  );
}
