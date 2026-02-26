import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getConsultants } from "@/app/actions/consultants";
import { getUsers } from "@/app/actions/users";
import { getRoleDefinitions } from "@/app/actions/roles";
import { ConsultantsView } from "@/components/consultants/consultants-view";

export default async function ConsultantsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [consultants, users, roleDefinitions] = await Promise.all([
    getConsultants(),
    getUsers(),
    getRoleDefinitions(),
  ]);

  return (
    <div className="space-y-6">
      <ConsultantsView consultants={consultants} users={users} roleDefinitions={roleDefinitions} />
    </div>
  );
}
