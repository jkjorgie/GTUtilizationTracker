import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUsers, getAllConsultantsForLinking } from "@/app/actions/users";
import { getAllUserTotpStatus } from "@/app/actions/totp";
import { UsersView } from "@/components/users/users-view";

export default async function UsersPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [users, consultants, totpStatus] = await Promise.all([
    getUsers(),
    getAllConsultantsForLinking(),
    getAllUserTotpStatus(),
  ]);

  return (
    <div className="space-y-6">
      <UsersView
        users={users}
        consultants={consultants}
        currentUserId={session.user.id}
        totpStatus={totpStatus}
      />
    </div>
  );
}
