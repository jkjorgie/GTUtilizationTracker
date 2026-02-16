import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getPTORequests } from "@/app/actions/pto";
import { getAllConsultants } from "@/app/actions/consultants";
import { PTOList } from "@/components/pto/pto-list";
import { PTOHeader } from "@/components/pto/pto-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PTOStatus } from "@prisma/client";

interface PTOPageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

async function PTOContent() {
  const session = await auth();
  if (!session) return null;

  const [allRequests, consultants] = await Promise.all([
    getPTORequests(),
    getAllConsultants(),
  ]);

  const pendingRequests = allRequests.filter(r => r.status === PTOStatus.PENDING);
  const approvedRequests = allRequests.filter(r => r.status === PTOStatus.APPROVED);
  const deniedRequests = allRequests.filter(r => r.status === PTOStatus.DENIED);

  return (
    <>
      <PTOHeader 
        consultants={consultants} 
        currentConsultantId={session.user.consultantId}
        isEmployee={session.user.role === "EMPLOYEE"}
      />

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="denied">
            Denied ({deniedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({allRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>PTO requests awaiting approval</CardDescription>
            </CardHeader>
            <CardContent>
              <PTOList 
                ptoRequests={pendingRequests} 
                userRole={session.user.role}
                currentConsultantId={session.user.consultantId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Approved Requests</CardTitle>
              <CardDescription>PTO requests that have been approved</CardDescription>
            </CardHeader>
            <CardContent>
              <PTOList 
                ptoRequests={approvedRequests} 
                userRole={session.user.role}
                currentConsultantId={session.user.consultantId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="denied">
          <Card>
            <CardHeader>
              <CardTitle>Denied Requests</CardTitle>
              <CardDescription>PTO requests that have been denied</CardDescription>
            </CardHeader>
            <CardContent>
              <PTOList 
                ptoRequests={deniedRequests} 
                userRole={session.user.role}
                currentConsultantId={session.user.consultantId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Requests</CardTitle>
              <CardDescription>Complete PTO request history</CardDescription>
            </CardHeader>
            <CardContent>
              <PTOList 
                ptoRequests={allRequests} 
                userRole={session.user.role}
                currentConsultantId={session.user.consultantId}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

export default async function PTOPage({ searchParams }: PTOPageProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading PTO requests...</div>}>
        <PTOContent />
      </Suspense>
    </div>
  );
}
