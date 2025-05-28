
"use client";

import Link from "next/link";
import Image from "next/image"; // Import next/image
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, UserCircle, Shield, Briefcase, Landmark, Wallet, Globe } from "lucide-react"; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User, Employee } from "@/types";
import { cn } from "@/lib/utils";
import React from "react";
import { useLanguage } from "@/contexts/LanguageContext"; // Assuming this might still be used if admin has lang features

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  const numericAmount = Number(amount);
  if (isNaN(numericAmount)) return "N/A";
  return `₹${numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function AppHeader() {
  const { loggedInEntity, userType, logout } = useAuth();
  
  // Conditionally use language context only if userType is admin
  let t: (key: string, params?: Record<string, string | number>) => string = (key) => key; // Default to key
  let currentLanguage: string | undefined;
  let setLanguage: ((language: "en" | "ta") => void) | undefined;

  if (userType === 'admin') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const langContext = useLanguage();
    if (langContext) {
      t = langContext.t;
      currentLanguage = langContext.language;
      setLanguage = langContext.setLanguage;
    }
  }
  
  if (!loggedInEntity) return null;

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
  }

  const entityFullname = loggedInEntity.fullname;
  const entityUsername = 'username' in loggedInEntity ? loggedInEntity.username : loggedInEntity.employeeId;
  const userDueAmount = (userType === 'user' && loggedInEntity && 'dueAmount' in loggedInEntity) ? (loggedInEntity as User).dueAmount : undefined;
  const userPhotoUrl = (loggedInEntity as User | Employee)?.photoUrl;


  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href={userType === 'admin' ? "/admin" : (userType === 'employee' ? "/employee/dashboard" : "/dashboard")} className="flex items-center gap-2">
           <Image 
            src="/sendhur_chits_header_logo.png" 
            alt="Sendhur Chits Logo"
            width={133} // Adjusted width for a common header height
            height={32} // Adjusted height
            priority
            data-ai-hint="company logo"
          />
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {userType === 'admin' && setLanguage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Globe className="h-4 w-4" />
                  <span className="sr-only">{t('toggleLanguage', { currentLanguage: currentLanguage === 'en' ? 'English' : 'Tamil' })}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('selectLanguage')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLanguage('en')} disabled={currentLanguage === 'en'}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('ta')} disabled={currentLanguage === 'ta'}>
                  தமிழ் (Tamil)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-sm text-foreground">
              {userType === 'admin' ? t('welcomeUser', {name: entityFullname}) : `Welcome, ${entityFullname}`}
            </span>
            {userType === 'user' && userDueAmount !== undefined && (
              <div className="flex items-center text-xs">
                <Wallet className="mr-1 h-3 w-3 text-muted-foreground" />
                <span className={cn(
                    "font-semibold",
                    (userDueAmount ?? 0) > 0 ? "text-destructive" : "text-green-600"
                )}>
                    Due: {formatCurrency(userDueAmount)}
                </span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={userPhotoUrl || `https://placehold.co/100x100.png?text=${getInitials(entityFullname)}`} alt={entityFullname} data-ai-hint="profile avatar"/>
                  <AvatarFallback>{getInitials(entityFullname)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{entityFullname}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userType === 'employee' ? `Employee ID: ${entityUsername}` : (userType === 'admin' ? `@${entityUsername}` : `@${entityUsername}`)}
                  </p>
                  {userType === 'user' && userDueAmount !== undefined && (
                    <div className="flex items-center sm:hidden mt-1 text-xs">
                         <Wallet className="mr-1 h-3 w-3 text-muted-foreground" />
                        <p className="leading-none">
                            Due: <span className={cn("font-semibold", (userDueAmount ?? 0) > 0 ? "text-destructive" : "text-green-600")}>{formatCurrency(userDueAmount)}</span>
                        </p>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {userType === 'admin' && (
                 <DropdownMenuItem asChild>
                   <Link href="/admin" className="flex items-center">
                    <Shield className="mr-2 h-4 w-4" />
                    {t('adminOverview')}
                   </Link>
                 </DropdownMenuItem>
              )}
              {userType === 'user' && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center">
                      <UserCircle className="mr-2 h-4 w-4" />
                      My Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/payment-history" className="flex items-center">
                      <Landmark className="mr-2 h-4 w-4" />
                      Payment History
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {userType === 'employee' && (
                <DropdownMenuItem asChild>
                  <Link href="/employee/dashboard" className="flex items-center">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Employee Dashboard
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {userType === 'admin' ? t('logout') : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
