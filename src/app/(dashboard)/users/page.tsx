import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUsers, getAllConsultantsForLinking } from "@/app/actions/users";
import { UsersView } from "@/components/users/users-view";

export default async function UsersPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [users, consultants] = await Promise.all([
    getUsers(),
    getAllConsultantsForLinking(),
  ]);

  return (
    <div className="space-y-6">
      <UsersView users={users} consultants={consultants} currentUserId={session.user.id} />
    </div>
  );
}
