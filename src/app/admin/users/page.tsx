
"use client";

import { useEffect, useState, useMemo } from "react";
import type { User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users, PlusCircle, Search, UserCircle as UserCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
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

  const formatDateSafe = (dateString: string | undefined | null): string => {
    if (!dateString) {
      return "N/A";
    }
    try {
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
    router.push(`/admin/users/${userId}`);
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return users;
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return users.filter(user =>
      user.fullname.toLowerCase().includes(lowercasedSearchTerm) ||
      user.phone.includes(searchTerm) ||
      user.username.toLowerCase().includes(lowercasedSearchTerm)
    );
  }, [users, searchTerm]);

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

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Name, Phone, or User ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full max-w-md shadow-sm"
          />
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          {/* Title and description can be part of the main page heading */}
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {searchTerm ? `No users found matching "${searchTerm}".` : "No users found. Click \"Create New User\" to add one."}
              </p>
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
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} onClick={() => handleUserRowClick(user.id)} className="cursor-pointer hover:bg-muted/50 transition-colors"><TableCell className="font-medium">{user.fullname}</TableCell><TableCell>{user.username}</TableCell><TableCell>{user.phone}</TableCell><TableCell>{formatDateSafe(user.dob)}</TableCell><TableCell>{user.isAdmin || user.username === 'admin' ? (<Badge variant="destructive">Admin</Badge>) : (<Badge variant="secondary">User</Badge>)}</TableCell><TableCell className="text-right">{user.groups?.length || 0}</TableCell><TableCell className="text-center"><Button asChild variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={(e) => e.stopPropagation()}><Link href={`/admin/collection/record?userId=${user.id}&fullname=${encodeURIComponent(user.fullname)}&username=${encodeURIComponent(user.username)}`}>Collection</Link></Button></TableCell></TableRow>
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
