import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getUtilizationData } from "@/app/actions/utilization";
import { getActiveProjects } from "@/app/actions/projects";
import { getRoleDefinitions } from "@/app/actions/roles";
import { UtilizationGrid } from "@/components/utilization/utilization-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

async function UtilizationContent() {
  const session = await auth();
  if (!session) return null;

  const [data, projects, roleDefinitions] = await Promise.all([
    getUtilizationData(),
    getActiveProjects(),
    getRoleDefinitions(),
  ]);

  return (
    <UtilizationGrid
      initialData={data}
      projects={projects}
      roleDefinitions={roleDefinitions}
      userRole={session.user.role}
      currentConsultantId={session.user.consultantId}
    />
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading utilization data...</span>
      </CardContent>
    </Card>
  );
}

export default async function UtilizationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Utilization</h1>
        <p className="text-muted-foreground">
          View and manage consultant allocations across projects
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilization Grid</CardTitle>
          <CardDescription>
            Click on a cell to edit allocations. Expand consultants to see project breakdowns. Past weeks show projected and actual hours in a split cell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingState />}>
            <UtilizationContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
