
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Layers, PlusCircle, LogOut, Briefcase, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext"; // Import useLanguage
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar"; 
import Image from "next/image";


export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { t } = useLanguage(); // Get translation function

  const navItems = [
    { href: "/admin", labelKey: "sidebarOverview" as const, icon: Home },
    { href: "/admin/users", labelKey: "sidebarManageUsers" as const, icon: Users },
    { href: "/admin/groups", labelKey: "sidebarManageGroups" as const, icon: Layers },
    { href: "/admin/groups/create", labelKey: "sidebarCreateGroup" as const, icon: PlusCircle },
    { href: "/admin/employees", labelKey: "sidebarManageEmployees" as const, icon: Briefcase },
    { href: "/admin/payments", labelKey: "sidebarPayments" as const, icon: CreditCard },
  ];

  return (
     <Sidebar className="border-r" collapsible="icon">
        <SidebarHeader className="p-4 items-center justify-center">
           <Link href="/admin" className="flex items-center gap-2 text-primary">
            <svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="text-primary group-data-[collapsible=icon]:mx-auto">
                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none"/>
                <path d="M30 50 Q50 30 70 50" stroke="currentColor" strokeWidth="5" fill="none"/>
                <path d="M30 50 Q50 70 70 50" stroke="currentColor" strokeWidth="5" fill="none"/>
                <circle cx="50" cy="50" r="10" fill="currentColor"/>
            </svg>
            <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">ChitConnect</span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2 flex flex-col">
          <SidebarMenu className="flex-grow">
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))}
                  tooltip={t(item.labelKey)} // Use translated tooltip
                  className="justify-start"
                >
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5 mr-3" />
                    <span className="group-data-[collapsible=icon]:hidden">{t(item.labelKey)}</span> {/* Translate label */}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t">
            <SidebarMenuButton onClick={logout} tooltip={t('sidebarLogout')} className="justify-start w-full text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <LogOut className="h-5 w-5 mr-3" />
                <span className="group-data-[collapsible=icon]:hidden">{t('sidebarLogout')}</span> {/* Translate logout */}
            </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>
  );
}
