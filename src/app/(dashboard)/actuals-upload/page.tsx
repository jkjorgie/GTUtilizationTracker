import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ActualsUploadView } from "@/components/actuals-upload/actuals-upload-view";

export default async function ActualsUploadPage() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Actuals Upload</h1>
        <p className="text-muted-foreground">
          Upload a PM Report spreadsheet to import actual hours into the utilization grid
        </p>
      </div>
      <ActualsUploadView />
    </div>
  );
}
