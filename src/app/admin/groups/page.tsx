
"use client";

import { useEffect, useState } from "react";
import type { Group } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image"; // Import next/image
import { Loader2, Layers, PlusCircle, Users, Landmark } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const groupsRef = collection(db, "groups");
        const q = query(groupsRef, orderBy("groupName"));
        const querySnapshot = await getDocs(q);
        const fetchedGroups = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        setGroups(fetchedGroups);
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  if (loading) {
    return (
       <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
       <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Group Management</h1>
                <p className="text-muted-foreground">View and manage all chit groups.</p>
            </div>
        </div>
        <Button asChild className="mt-4 sm:mt-0 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/admin/groups/create">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Group
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="text-center py-10 shadow-lg">
          <CardHeader>
            <Layers className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-xl">No Groups Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>There are no chit groups created yet. Get started by creating one!</CardDescription>
            <Button asChild className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/admin/groups/create">Create Group</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link key={group.id} href={`/admin/groups/${group.id}`} className="block h-full">
              <Card className="shadow-lg flex flex-col h-full hover:shadow-xl transition-shadow duration-300 cursor-pointer overflow-hidden">
                <div className="relative w-full h-40">
                  <Image
                    src={`https://placehold.co/600x400.png?text=${encodeURIComponent(group.groupName)}`}
                    alt={`${group.groupName} group image`}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint="community group"
                  />
                </div>
                <CardHeader className="pt-4">
                  <CardTitle className="text-xl text-primary">{group.groupName}</CardTitle>
                  <CardDescription className="h-16 overflow-y-auto text-sm">{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex-grow">
                  <div className="flex items-center text-sm">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Capacity: {group.totalPeople} members</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Total Amount: ₹{group.totalAmount.toLocaleString()}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Members ({group.members.length}):</h4>
                    {group.members.length > 0 ? (
                      <ScrollArea className="h-20 rounded-md border p-2">
                        <div className="flex flex-wrap gap-1">
                          {group.members.map(memberUsername => (
                            <Badge key={memberUsername} variant="secondary">{memberUsername}</Badge>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-xs text-muted-foreground">No members yet.</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4 mt-auto">
                  <p className="text-xs text-muted-foreground">Group ID: {group.id}</p>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
