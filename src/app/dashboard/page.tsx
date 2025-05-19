
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Group, User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { UserGroupCard } from "@/components/dashboard/UserGroupCard";
import { Loader2, ListX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.groups && user.groups.length > 0) {
      const fetchGroups = async () => {
        setLoading(true);
        try {
          const groupsRef = collection(db, "groups");
          // Firestore 'in' query supports up to 30 elements in the array.
          // For more, batching or alternative structuring is needed.
          // For this scaffold, assume user.groups.length <= 30.
          const q = query(groupsRef, where(documentId(), "in", user.groups.slice(0,30) ));
          const querySnapshot = await getDocs(q);
          const userGroups = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
          setGroups(userGroups);
        } catch (error) {
          console.error("Error fetching groups:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchGroups();
    } else {
      setLoading(false);
      setGroups([]);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading your groups...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground mb-4 sm:mb-0">Your Chit Groups</h1>
        {user?.isAdmin && (
          <Button asChild variant="outline">
            <Link href="/admin/groups/create">Create New Group</Link>
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-lg shadow-md">
          <ListX className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground">No Groups Yet</h2>
          <p className="text-muted-foreground mt-2">
            You are not part of any chit groups.
            {user?.isAdmin ? " As an admin, you can create new groups." : " Contact an admin to be added to a group."}
          </p>
          {user?.isAdmin && (
             <Button asChild className="mt-6" variant="default">
                <Link href="/admin/groups/create">Create Group</Link>
             </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <UserGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
