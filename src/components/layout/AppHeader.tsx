
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, UserCircle, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { user, isAdmin, logout } = useAuth();

  if (!user) return null;

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
           <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none"/>
            <path d="M30 50 Q50 30 70 50" stroke="currentColor" strokeWidth="5" fill="none"/>
            <path d="M30 50 Q50 70 70 50" stroke="currentColor" strokeWidth="5" fill="none"/>
            <circle cx="50" cy="50" r="10" fill="currentColor"/>
          </svg>
          <span className="text-xl font-bold text-primary">ChitConnect</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">Welcome, {user.fullname}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(user.fullname)}`} alt={user.fullname} data-ai-hint="profile avatar" />
                  <AvatarFallback>{getInitials(user.fullname)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.fullname}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                 <DropdownMenuItem asChild>
                   <Link href="/admin" className="flex items-center">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Panel
                   </Link>
                 </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="flex items-center">
                  <UserCircle className="mr-2 h-4 w-4" />
                   Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
