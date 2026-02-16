import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getUtilizationData } from "@/app/actions/utilization";
import { getActiveProjects } from "@/app/actions/projects";
import { UtilizationGrid } from "@/components/utilization/utilization-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

async function UtilizationContent() {
  const session = await auth();
  if (!session) return null;

  const [data, projects] = await Promise.all([
    getUtilizationData(),
    getActiveProjects(),
  ]);

  return (
    <UtilizationGrid
      data={data}
      projects={projects}
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
            Click on a cell to view details or add allocations. Toggle between actuals, projected, and difference views.
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
