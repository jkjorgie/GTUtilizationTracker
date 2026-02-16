import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjects } from "@/app/actions/projects";
import { ProjectTable } from "@/components/projects/project-table";
import { ProjectsHeader } from "@/components/projects/projects-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectType, ProjectStatus } from "@prisma/client";

interface ProjectsPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    search?: string;
  }>;
}

async function ProjectsList({ searchParams }: { searchParams: ProjectsPageProps["searchParams"] }) {
  const params = await searchParams;
  const projects = await getProjects({
    status: params.status as ProjectStatus | undefined,
    type: params.type as ProjectType | undefined,
    search: params.search,
  });

  return <ProjectTable projects={projects} />;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <ProjectsHeader />
      
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading projects...</div>}>
            <ProjectsList searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
