
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User, Group } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, documentId, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { 
  Loader2, 
  ArrowLeft, 
  User as UserIconLucide, 
  Info, 
  AlertTriangle, 
  Phone, 
  CalendarDays, 
  Home, 
  Users as GroupIcon,
  Briefcase, 
  FileText, 
  Shield, 
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Separator } from "@/components/ui/separator";

const formatDateSafe = (dateString: string | Date | undefined | null): string => {
  if (!dateString) return "N/A";
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (isNaN(date.getTime())) return "N/A";
    return format(date, "dd MMMM yyyy");
  } catch (e) {
    return "N/A";
  }
};

export default function EmployeeViewUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetails = useCallback(async () => {
    if (!userId) {
      setError("User ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setError("User not found.");
        setLoading(false);
        return;
      }
      const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
      setUser(userData);

      if (userData.groups && userData.groups.length > 0) {
        const groupsRef = collection(db, "groups");
        const groupIds = userData.groups.slice(0, 30); 
        if (groupIds.length > 0) {
          const q = query(groupsRef, where(documentId(), "in", groupIds));
          const querySnapshot = await getDocs(q);
          const fetchedGroups = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Group));
          setUserGroups(fetchedGroups);
        } else {
          setUserGroups([]);
        }
      } else {
        setUserGroups([]);
      }
    } catch (err) {
      console.error("Error fetching user details:", err);
      setError("Failed to fetch user details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading user details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader><CardTitle className="text-destructive flex items-center justify-center"><AlertTriangle className="mr-2 h-6 w-6" /> Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push("/employee/users")} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">User data not available.</div>;
  }

  const isAdminUser = user.isAdmin || user.username === 'admin';

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push("/employee/users")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Users
        </Button>
      </div>

      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-secondary/50 p-6 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {(user.photoUrl) && (<Image src={user.photoUrl} alt={`${user.fullname}'s photo`} width={100} height={100} className="rounded-full border-4 border-card object-cover" data-ai-hint="user profile photo"/>)}
            <div className="flex-grow">
              <CardTitle className="text-3xl font-bold text-foreground flex items-center">
                {user.fullname} {isAdminUser && <Badge variant="destructive" className="ml-3"><Shield className="mr-1 h-4 w-4"/>Admin</Badge>}
              </CardTitle>
              <CardDescription>@{user.username} (User ID: {user.id})</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><Info className="mr-2 h-5 w-5" />Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Phone:</strong> {user.phone}</div></div>
              <div className="flex items-start"><CalendarDays className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Date of Birth:</strong> {formatDateSafe(user.dob)}</div></div>
              <div className="flex items-start col-span-1 md:col-span-2"><Home className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Address:</strong> {user.address || "N/A"}</div></div>
              <div className="flex items-start"><Briefcase className="mr-2 mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" /><div><strong className="block text-foreground">Referred By:</strong> {user.referralPerson || "N/A"}</div></div>
            </div>
          </section>
          <Separator />
           <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><DollarSign className="mr-2 h-5 w-5" />Financial Information</h3>
            <div className="space-y-3 text-sm">
               <div className="flex items-center"><strong className="text-foreground w-28">Due Amount:</strong>{user.dueAmount !== undefined && user.dueAmount !== null ? `₹${user.dueAmount.toLocaleString()}` : "N/A"}</div>
            </div>
          </section>
          <Separator />
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><FileText className="mr-2 h-5 w-5" />Uploaded Documents</h3>
            <div className="space-y-3 text-sm">
              {user.aadhaarCardUrl ? (<div className="flex items-center"><strong className="text-foreground w-28">Aadhaar Card:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.aadhaarCardUrl} target="_blank" rel="noopener noreferrer">View Document</a></Button></div>) : <p className="text-muted-foreground">Aadhaar Card: Not Uploaded</p>}
              {user.panCardUrl ? (<div className="flex items-center"><strong className="text-foreground w-28">PAN Card:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.panCardUrl} target="_blank" rel="noopener noreferrer">View Document</a></Button></div>) : <p className="text-muted-foreground">PAN Card: Not Uploaded</p>}
              {user.photoUrl ? (<div className="flex items-center"><strong className="text-foreground w-28">Photograph:</strong><Button variant="link" asChild className="p-0 h-auto"><a href={user.photoUrl} target="_blank" rel="noopener noreferrer">View Photo</a></Button></div>) : <p className="text-muted-foreground">Photograph: Not Uploaded</p>}
            </div>
          </section>
          <Separator />
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><GroupIcon className="mr-2 h-5 w-5" />Joined Groups ({userGroups.length})</h3>
            {userGroups.length > 0 ? (<ul className="list-disc list-inside space-y-1 text-sm">{userGroups.map(group => (<li key={group.id}><Link href={`/employee/groups/${group.id}`} className="text-primary hover:underline">{group.groupName}</Link><span className="text-muted-foreground text-xs ml-2">(ID: {group.id})</span></li>))}</ul>) : (<p className="text-sm text-muted-foreground">This user has not joined any groups yet.</p>)}
          </section>
          <Separator />
          <section>
             <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><DollarSign className="mr-2 h-5 w-5" />Payment History</h3>
             <Card className="bg-secondary/30"><CardContent className="pt-6"><p className="text-sm text-muted-foreground text-center">Payment history feature is currently under development.</p></CardContent></Card>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
