
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Layers, Briefcase, TrendingUp, Loader2 } from "lucide-react"; // Added TrendingUp and Loader2
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import type { Group, CollectionRecord } from "@/types"; // Added CollectionRecord

export default function AdminOverviewPage() {
  const [userCount, setUserCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [activeGroupCount, setActiveGroupCount] = useState(0);
  const [closedGroupCount, setClosedGroupCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [totalCollectionAmount, setTotalCollectionAmount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingStats(true);
      try {
        // Fetch Users
        const usersSnapshot = await getDocs(collection(db, "users"));
        setUserCount(usersSnapshot.size);
        
        // Fetch Groups and determine active/closed
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
            active++; 
          }
        }
        setActiveGroupCount(active);
        setClosedGroupCount(closed);
        
        // Fetch Employees
        const employeesSnapshot = await getDocs(collection(db, "employees"));
        setEmployeeCount(employeesSnapshot.size);

        // Fetch Total Collections
        const collectionsSnapshot = await getDocs(collection(db, "collectionRecords"));
        let totalCollected = 0;
        collectionsSnapshot.forEach(doc => {
          const data = doc.data() as CollectionRecord;
          if (data.amount && typeof data.amount === 'number') {
            totalCollected += data.amount;
          }
        });
        setTotalCollectionAmount(totalCollected);

      } catch (error) {
        console.error("Error fetching admin overview data:", error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "₹0.00";
    return `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Admin Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"> {/* Changed to lg:grid-cols-4 */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{userCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Layers className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{groupCount}</div>
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
            {loadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{employeeCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Registered employees</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(totalCollectionAmount)}</div>
            )}
            <p className="text-xs text-muted-foreground">From customer collections</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
