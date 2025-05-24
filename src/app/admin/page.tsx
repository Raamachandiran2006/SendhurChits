
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Layers, BarChart3, PlusCircle, Briefcase } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore"; // Added query and where
import { db } from "@/lib/firebase";
import type { Group } from "@/types"; // Import Group type

export default function AdminOverviewPage() {
  const { loggedInEntity } = useAuth(); 
  const [userCount, setUserCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [activeGroupCount, setActiveGroupCount] = useState(0);
  const [closedGroupCount, setClosedGroupCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loadingGroupStats, setLoadingGroupStats] = useState(true);

  const adminUser = loggedInEntity; 

  useEffect(() => {
    const fetchData = async () => {
      setLoadingGroupStats(true);
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        setUserCount(usersSnapshot.size);
        
        const groupsSnapshot = await getDocs(collection(db, "groups"));
        setGroupCount(groupsSnapshot.size);

        let active = 0;
        let closed = 0;
        const groupDocs = groupsSnapshot.docs;

        for (const groupDoc of groupDocs) {
          const group = { id: groupDoc.id, ...groupDoc.data() } as Group;
          if (group.tenure && group.tenure > 0) {
            const auctionQuery = query(collection(db, "auctionRecords"), where("groupId", "==", group.id));
            const auctionSnapshot = await getDocs(auctionQuery);
            const numAuctions = auctionSnapshot.size;
            if (numAuctions >= group.tenure) {
              closed++;
            } else {
              active++;
            }
          } else {
            // If no tenure, consider it active unless other logic defines it as closed
            active++; 
          }
        }
        setActiveGroupCount(active);
        setClosedGroupCount(closed);
        
        const employeesSnapshot = await getDocs(collection(db, "employees"));
        setEmployeeCount(employeesSnapshot.size);

      } catch (error) {
        console.error("Error fetching admin overview data:", error);
      } finally {
        setLoadingGroupStats(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Admin Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Layers className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupCount}</div>
            {loadingGroupStats ? (
              <p className="text-xs text-muted-foreground">Loading stats...</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Active: {activeGroupCount}</p>
                <p className="text-xs text-muted-foreground">Closed: {closedGroupCount}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeCount}</div>
            <p className="text-xs text-muted-foreground">Registered employees</p>
          </CardContent>
        </Card>
         <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Operational</div>
            <p className="text-xs text-muted-foreground">All systems running smoothly</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Perform common administrative tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start" variant="outline"><Link href="/admin/users"><Users className="mr-2 h-4 w-4" /> Manage Users</Link></Button>
            <Button asChild className="w-full justify-start" variant="outline"><Link href="/admin/groups"><Layers className="mr-2 h-4 w-4" /> Manage Groups</Link></Button>
            <Button asChild className="w-full justify-start" variant="outline"><Link href="/admin/employees"><Briefcase className="mr-2 h-4 w-4" /> Manage Employees</Link></Button>
            <Button asChild className="w-full justify-start" variant="default"><Link href="/admin/groups/create"><PlusCircle className="mr-2 h-4 w-4" /> Create Group</Link></Button>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>{adminUser ? `Welcome, ${adminUser.fullname}!` : 'Welcome Admin!'}</CardTitle>
            <CardDescription>Here are some tips for managing ChitConnect:</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Regularly review user activity.</li>
              <li>Ensure group details are accurate and up-to-date.</li>
              <li>Monitor employee activities and performance.</li>
              <li>Monitor system performance and report any issues.</li>
              <li>Keep your admin credentials secure.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
