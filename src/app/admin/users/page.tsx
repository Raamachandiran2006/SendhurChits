
"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Users, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        // Order by fullname now as username is internal
        const q = query(usersRef, orderBy("fullname")); 
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const formatDateSafe = (dateString: string | undefined | null) => {
    if (!dateString) {
      return "N/A";
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "N/A";
      }
      return format(date, "dd MMM yyyy");
    } catch (e) {
      return "N/A";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">User Management</h1>
                <p className="text-muted-foreground">View and manage all registered users.</p>
            </div>
        </div>
        <Button asChild className="mt-4 sm:mt-0 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/admin/users/create">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New User
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
           {/* Title moved up */}
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No users found. Click "Create New User" to add one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Username (ID)</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Groups Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.fullname}</TableCell>
                      <TableCell>{user.username}</TableCell> {/* Display internal username */}
                      <TableCell>{user.phone}</TableCell>
                      <TableCell>{formatDateSafe(user.dob)}</TableCell>
                      <TableCell>
                        {user.isAdmin || user.username === 'admin' ? (
                          <Badge variant="destructive">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{user.groups?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
