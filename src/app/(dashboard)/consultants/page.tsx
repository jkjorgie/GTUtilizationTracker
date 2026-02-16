import { Suspense } from "react";
import { getConsultants } from "@/app/actions/consultants";
import { ConsultantTable } from "@/components/consultants/consultant-table";
import { ConsultantsHeader } from "@/components/consultants/consultants-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupType, RoleLevel } from "@prisma/client";

interface ConsultantsPageProps {
  searchParams: Promise<{
    group?: string;
    role?: string;
    search?: string;
  }>;
}

async function ConsultantsList({ searchParams }: { searchParams: ConsultantsPageProps["searchParams"] }) {
  const params = await searchParams;
  const consultants = await getConsultants({
    group: params.group as GroupType | undefined,
    role: params.role as RoleLevel | undefined,
    search: params.search,
  });

  return <ConsultantTable consultants={consultants} />;
}

export default async function ConsultantsPage({ searchParams }: ConsultantsPageProps) {
  return (
    <div className="space-y-6">
      <ConsultantsHeader />
      
      <Card>
        <CardHeader>
          <CardTitle>All Consultants</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading consultants...</div>}>
            <ConsultantsList searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
