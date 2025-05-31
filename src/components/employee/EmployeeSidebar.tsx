
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Layers, Briefcase, LogOut, DollarSign, ArchiveRestore, Sheet as SheetIcon, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar, 
} from "@/components/ui/sidebar";
import type { Employee } from "@/types";

const baseNavItems = [
  { href: "/employee/dashboard", label: "Dashboard", icon: Home },
  { href: "/employee/users", label: "View Users", icon: Users },
  { href: "/employee/groups", label: "View Groups", icon: Layers },
  { href: "/employee/employees", label: "View Colleagues", icon: Briefcase },
  { href: "/employee/salary", label: "My Salary", icon: DollarSign },
  { href: "/employee/collection", label: "Collection", icon: ArchiveRestore },
  { href: "/employee/due-sheet", label: "Due Sheet", icon: SheetIcon },
];

const managerNavItems = [
  ...baseNavItems,
  { href: "/employee/payments", label: "Payments", icon: CreditCard },
];

export function EmployeeSidebar() {
  const pathname = usePathname();
  const { logout, loggedInEntity, userType } = useAuth();
  const { state: sidebarState } = useSidebar(); 

  const employee = userType === 'employee' ? loggedInEntity as Employee : null;
  const isManager = employee?.role === "Manager";
  const navItems = isManager ? managerNavItems : baseNavItems;

  return (
     <Sidebar className="border-r" collapsible="icon">
        <SidebarHeader className="p-4 items-center justify-center">
           <Link href="/employee/dashboard" className="flex items-center gap-2 text-primary">
            <svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="text-primary group-data-[collapsible=icon]:mx-auto">
                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none"/>
                <path d="M30 50 Q50 30 70 50" stroke="currentColor" strokeWidth="5" fill="none"/>
                <path d="M30 50 Q50 70 70 50" stroke="currentColor" strokeWidth="5" fill="none"/>
                <circle cx="50" cy="50" r="10" fill="currentColor"/>
            </svg>
            <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">Sendhur Chits</span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2 flex flex-col">
          <SidebarMenu className="flex-grow">
            {navItems.map((item) => {
              const isSalaryPage = item.href === "/employee/salary";
              const hasNotification = employee?.hasUnreadSalaryNotification;

              return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href !== "/employee/dashboard" && pathname.startsWith(item.href))}
                  tooltip={item.label}
                  className="justify-start relative" 
                >
                  <Link href={item.href} className="flex items-center w-full">
                    <item.icon className="h-5 w-5 mr-3" />
                    <span className="group-data-[collapsible=icon]:hidden flex-grow">{item.label}</span>
                    {isSalaryPage && hasNotification && sidebarState === "expanded" && (
                      <span className="ml-auto bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">1</span>
                    )}
                    {isSalaryPage && hasNotification && sidebarState === "collapsed" && (
                      <span className="absolute top-1 right-1 bg-red-500 w-2 h-2 rounded-full border border-sidebar-background"></span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t">
            <SidebarMenuButton onClick={logout} tooltip="Log Out" className="justify-start w-full text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <LogOut className="h-5 w-5 mr-3" />
                <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>
  );
}
