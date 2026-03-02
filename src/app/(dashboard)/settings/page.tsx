import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllSystemSettings } from "@/app/actions/system-settings";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const settings = await getAllSystemSettings();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure global settings for the application.</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
