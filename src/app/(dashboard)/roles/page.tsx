import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleDefinitions } from "@/app/actions/roles";
import { RolesView } from "@/components/roles/roles-view";

export default async function RolesPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const roles = await getRoleDefinitions();

  return (
    <div className="space-y-6">
      <RolesView roles={roles} />
    </div>
  );
}
