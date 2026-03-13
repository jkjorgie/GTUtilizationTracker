import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getPendingPTOCount } from "@/app/actions/pto";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.requirePasswordReset) {
    redirect("/force-reset");
  }

  const pendingPTOCount = await getPendingPTOCount();

  return (
    <div className="min-h-screen flex">
      <Sidebar userRole={session.user.role} pendingPTOCount={pendingPTOCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={session.user} />
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
