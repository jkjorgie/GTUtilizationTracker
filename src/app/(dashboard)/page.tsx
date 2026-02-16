import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, FolderKanban, Calendar } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  const quickActions = [
    {
      title: "Utilization View",
      description: "View and edit consultant allocations",
      href: "/utilization",
      icon: <BarChart3 className="h-8 w-8" />,
    },
    {
      title: "PTO Requests",
      description: "Submit or manage PTO requests",
      href: "/pto",
      icon: <Calendar className="h-8 w-8" />,
    },
    ...(session?.user.role === "ADMIN"
      ? [
          {
            title: "Manage Projects",
            description: "Add and edit projects",
            href: "/projects",
            icon: <FolderKanban className="h-8 w-8" />,
          },
          {
            title: "Manage Consultants",
            description: "Add and edit consultant records",
            href: "/consultants",
            icon: <Users className="h-8 w-8" />,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome, {session?.user.name || session?.user.email}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your utilization tracker
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {action.title}
                </CardTitle>
                <div className="text-muted-foreground">{action.icon}</div>
              </CardHeader>
              <CardContent>
                <CardDescription>{action.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Quick tips to help you navigate the utilization tracker
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-medium">For Employees</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• View your utilization in the Utilization view</li>
                <li>• Submit PTO requests through the PTO page</li>
                <li>• Track your project allocations</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">For Managers</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Approve or deny PTO requests</li>
                <li>• Use Mass Load for bulk allocations</li>
                <li>• Monitor team utilization</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
