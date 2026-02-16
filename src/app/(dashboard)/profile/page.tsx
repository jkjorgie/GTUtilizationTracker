import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProfile } from "@/app/actions/profile";
import { ProfileView } from "@/components/profile/profile-view";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const profile = await getProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">View and manage your account settings</p>
      </div>

      <ProfileView profile={profile} />
    </div>
  );
}
