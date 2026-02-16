import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getConsultants } from "@/app/actions/consultants";
import { ConsultantsView } from "@/components/consultants/consultants-view";

export default async function ConsultantsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch all consultants - filtering is done client-side for instant search
  const consultants = await getConsultants();

  return (
    <div className="space-y-6">
      <ConsultantsView consultants={consultants} />
    </div>
  );
}
