
"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card"; // Removed CardTitle, CardDescription
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users as UsersIcon, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

export default function EmployeeViewUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        // Fetch all users and then filter client-side to exclude admins
        const q = query(usersRef, orderBy("fullname")); 
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as User))
          .filter(user => !(user.isAdmin || user.username === 'admin')); // Exclude admins
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const formatDateSafe = (dateString: string | undefined | null): string => {
    if (!dateString) {
      return "N/A";
    }
    try {
      // Attempt to parse ISO strings first, then general date strings
      const date = dateString.includes('T') ? parseISO(dateString) : new Date(dateString.replace(/-/g, '/'));
      if (isNaN(date.getTime())) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; 
          const day = parseInt(parts[2]);
          const directDate = new Date(year, month, day);
          if (!isNaN(directDate.getTime())) {
            return format(directDate, "dd MMM yyyy");
          }
        }
        return "N/A";
      }
      return format(date, "dd MMM yyyy");
    } catch (e) {
      console.warn("Date formatting error for:", dateString, e);
      return "N/A";
    }
  };

  const handleUserRowClick = (userId: string) => {
    router.push(`/employee/users/${userId}`);
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
            <UsersIcon className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">View Users</h1>
                <p className="text-muted-foreground">Browse registered user accounts (excluding admins).</p>
            </div>
        </div>
        <Button variant="outline" asChild className="mt-4 sm:mt-0">
          <Link href="/employee/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
            {/* Title and description are in the page header */}
        </CardHeader>
        <CardContent className="pt-6">
          {users.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No users found.</p>
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
                    <TableRow 
                      key={user.id} 
                      onClick={() => handleUserRowClick(user.id)}
                      className="cursor-pointer hover:bg-muted/70 transition-colors"
                    >
                      <TableCell className="font-medium">{user.fullname}</TableCell><TableCell>{user.username}</TableCell><TableCell>{user.phone}</TableCell><TableCell>{formatDateSafe(user.dob)}</TableCell><TableCell><Badge variant="secondary">User</Badge></TableCell><TableCell className="text-right">{user.groups?.length || 0}</TableCell>
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
