"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { User, Employee } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Sheet as SheetIcon,
  UserCircle,
  Phone,
  Search,
  Send as SendIcon,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0.00";
  return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function EmployeeDueSheetPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [employeesForSms, setEmployeesForSms] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeForSms, setSelectedEmployeeForSms] = useState<string | undefined>(undefined);
  const [isSendingSms, setIsSendingSms] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("fullname"));
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

        const relevantUsers = fetchedUsers.filter(user =>
          !(user.isAdmin || user.username === 'admin') &&
          (user.dueAmount && user.dueAmount > 0)
        );
        setAllUsers(relevantUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const fetchEmployeesForSms = async () => {
    if (employeesForSms.length > 0) return;
    setLoadingEmployees(true);
    try {
      const employeesSnapshot = await getDocs(query(collection(db, "employees"), orderBy("fullname")));
      const fetchedEmployees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployeesForSms(fetchedEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({ title: "Error", description: "Could not load employees list.", variant: "destructive" });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return allUsers;
    const lower = searchTerm.toLowerCase();
    return allUsers.filter(user =>
      user.username.toLowerCase().includes(lower) ||
      user.fullname.toLowerCase().includes(lower) ||
      user.phone.includes(searchTerm)
    );
  }, [allUsers, searchTerm]);

  const handleRowClick = (userId: string, e: React.MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('[data-checkbox-cell="true"]')) return;
    router.push(`/employee/users/${userId}#due-sheet`);
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUserIds(prev => checked ? [...prev, userId] : prev.filter(id => id !== userId));
  };

  const handleOpenEmployeeDialog = () => {
    if (selectedUserIds.length === 0) return;
    fetchEmployeesForSms();
    setIsEmployeeDialogOpen(true);
  };

  const handleConfirmSendSms = async () => {
    if (!selectedEmployeeForSms) {
      toast({
        title: "Error",
        description: "Please select an employee to send the SMS to.",
        variant: "destructive",
      });
      return;
    }

    const targetEmployee = employeesForSms.find(emp => emp.id === selectedEmployeeForSms);
    if (!targetEmployee || !targetEmployee.phone) {
      toast({
        title: "Error",
        description: "Selected employee phone number not found.",
        variant: "destructive",
      });
      return;
    }

    const usersToSendDetails = selectedUserIds
      .map(id => {
        const user = allUsers.find(u => u.id === id);
        return user
          ? {
              username: user.username,
              fullname: user.fullname,
              phone: user.phone,
              dueAmount: user.dueAmount || 0,
            }
          : null;
      })
      .filter(Boolean);

    if (usersToSendDetails.length === 0) {
      toast({
        title: "Error",
        description: "No valid users selected.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingSms(true);
    try {
      const response = await fetch("/api/send-due-summary-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeePhoneNumber: targetEmployee.phone,
          dueUserDetails: usersToSendDetails,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast({
          title: "SMS Sent",
          description: `Due summary sent to ${targetEmployee.fullname}.`,
        });
        setIsEmployeeDialogOpen(false);
        setSelectedUserIds([]);
        setSelectedEmployeeForSms(undefined);
      } else {
        throw new Error(result.error || "Failed to send SMS");
      }
    } catch (error: any) {
      console.error("SMS error:", error);
      toast({
        title: "SMS Error",
        description: error.message || "Could not send SMS.",
        variant: "destructive",
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <SheetIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customer Due Sheet</h1>
            <p className="text-muted-foreground">Overview of pending dues from customers (excluding admins and zero/negative dues).</p>
          </div>
        </div>
        <Button variant="outline" asChild className="mt-4 sm:mt-0">
          <Link href="/employee/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by User ID, Name, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full shadow-sm"
          />
        </div>
        <Button
          onClick={handleOpenEmployeeDialog}
          disabled={selectedUserIds.length === 0}
          className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <SendIcon className="mr-2 h-4 w-4" /> Send to Employee
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Outstanding Due Amounts</CardTitle>
          <CardDescription>
            List of customers with positive due amounts. Select users to send their due details via SMS to an employee.
            {searchTerm && ` Showing results for "${searchTerm}".`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Loading due sheet...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {searchTerm
                  ? `No customers found matching "${searchTerm}" with outstanding dues.`
                  : "No customers with outstanding dues found."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>S.No</TableHead>
                    <TableHead>Username (ID)</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Phone No</TableHead>
                    <TableHead className="text-right">Due Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      onClick={(e) => handleRowClick(user.id, e)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      data-state={selectedUserIds.includes(user.id) ? "selected" : ""}
                    >
                      <TableCell data-checkbox-cell="true" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={(checked: boolean) => handleSelectUser(user.id, checked)}
                          aria-label={`Select user ${user.fullname}`}
                        />
                      </TableCell>
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

      <AlertDialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Employee to Send SMS</AlertDialogTitle>
            <AlertDialogDescription>
              Choose an employee who will receive the due details for the selected {selectedUserIds.length} user(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          {loadingEmployees ? (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2">Loading employees...</p>
            </div>
          ) : employeesForSms.length === 0 ? (
            <p className="text-muted-foreground text-center">No employees found.</p>
          ) : (
            <Select onValueChange={setSelectedEmployeeForSms} value={selectedEmployeeForSms}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {employeesForSms.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.fullname} ({emp.employeeId}) - {emp.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEmployeeForSms(undefined)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSendSms}
              disabled={
                !selectedEmployeeForSms || loadingEmployees || isSendingSms || employeesForSms.length === 0
              }
            >
              {isSendingSms && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Send SMS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
