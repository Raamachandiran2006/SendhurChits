
"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, ArrowLeft, Sheet as SheetIcon, UserCircle, Phone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0.00"; // Or "N/A"
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function EmployeeDueSheetPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("fullname"));
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        
        // Filter out admin users
        const nonAdminUsers = fetchedUsers.filter(user => !(user.isAdmin || user.username === 'admin'));
        setUsers(nonAdminUsers);

      } catch (error) {
        console.error("Error fetching users for due sheet:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <SheetIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customer Due Sheet</h1>
            <p className="text-muted-foreground">Overview of pending dues from customers.</p>
          </div>
        </div>
        <Button variant="outline" asChild className="mt-4 sm:mt-0">
          <Link href="/employee/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Due Amounts List</CardTitle>
          <CardDescription>List of customers and their current due amounts (excluding admins).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Loading due sheet...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No customer data found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Username (ID)</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Phone No</TableHead>
                    <TableHead className="text-right">Due Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <TableRow key={user.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <UserCircle className="h-4 w-4 text-muted-foreground" />
                           {user.username}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{user.fullname}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <Phone className="h-4 w-4 text-muted-foreground" />
                           {user.phone}
                        </div>
                        </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(user.dueAmount)}</TableCell>
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
