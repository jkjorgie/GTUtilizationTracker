"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Calendar,
  Upload,
  BarChart3,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Utilization",
    href: "/utilization",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: <FolderKanban className="h-5 w-5" />,
    roles: ["ADMIN"],
  },
  {
    label: "Consultants",
    href: "/consultants",
    icon: <Users className="h-5 w-5" />,
    roles: ["ADMIN"],
  },
  {
    label: "PTO Requests",
    href: "/pto",
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    label: "Mass Load",
    href: "/mass-load",
    icon: <Upload className="h-5 w-5" />,
    roles: ["ADMIN", "MANAGER"],
  },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">GT Utilization</h1>
        <p className="text-sm text-muted-foreground">Tracker</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Role: {userRole}
        </p>
      </div>
    </aside>
  );
}
