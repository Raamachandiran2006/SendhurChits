
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Group, User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { UserGroupCard } from "@/components/dashboard/UserGroupCard";
import { Loader2, ListX, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
  const { loggedInEntity } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const user = loggedInEntity as User | null;

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    const names = name.split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
  }

  useEffect(() => {
    if (user && user.groups && user.groups.length > 0) {
      const fetchGroups = async () => {
        setLoadingGroups(true);
        try {
          const groupsRef = collection(db, "groups");
          const q = query(groupsRef, where(documentId(), "in", user.groups.slice(0,30) ));
          const querySnapshot = await getDocs(q);
          const userGroups = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
          setGroups(userGroups);
        } catch (error) {
          console.error("Error fetching groups:", error);
        } finally {
          setLoadingGroups(false);
        }
      };
      fetchGroups();
    } else {
      setLoadingGroups(false);
      setGroups([]);
    }
  }, [user]);

  if (loadingGroups && (!user || (user.groups && user.groups.length > 0))) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center gap-4 mb-4 sm:mb-0">
          {user?.photoUrl ? (
            <Image 
              src={user.photoUrl} 
              alt={`${user.fullname}'s photo`} 
              width={80} 
              height={80} 
              className="rounded-full border-2 border-primary object-cover"
              data-ai-hint="user profile"
            />
          ) : (
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarFallback className="text-3xl bg-secondary text-secondary-foreground">
                {getInitials(user?.fullname)}
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome, {user?.fullname}!</h1>
            <p className="text-muted-foreground">Here's an overview of your account.</p>
          </div>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Quick Access</CardTitle>
          <CardDescription>Manage your payments and groups.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard/payment-history">
                <Landmark className="mr-2 h-4 w-4" /> View Payment History
              </Link>
            </Button>
        </CardContent>
      </Card>


      {groups.length === 0 && !loadingGroups ? (
        <div className="text-center py-10 bg-card rounded-lg shadow-md">
          <ListX className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground">No Groups Yet</h2>
          <p className="text-muted-foreground mt-2">
            You are not part of any chit groups.
            Contact an admin to be added to a group.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-6">Your Chit Groups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <UserGroupCard key={group.id} group={group} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
