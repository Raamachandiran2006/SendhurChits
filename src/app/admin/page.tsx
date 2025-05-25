
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Users, Layers, Briefcase, TrendingUp, Loader2, AlertTriangle, Banknote, Wallet, CalendarIcon, Sheet } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Group, CollectionRecord, PaymentRecord, SalaryRecord, ExpenseRecord, CreditRecord, DaySheetRow } from "@/types";
import { format as formatDateFns, startOfDay as dateFnsStartOfDay, endOfDay as dateFnsEndOfDay } from "date-fns";

export default function AdminOverviewPage() {
  const [userCount, setUserCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [activeGroupCount, setActiveGroupCount] = useState(0);
  const [closedGroupCount, setClosedGroupCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [totalCollectionAmount, setTotalCollectionAmount] = useState(0);
  const [totalPenaltyAmount, setTotalPenaltyAmount] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const [selectedDateForDaySheet, setSelectedDateForDaySheet] = useState<Date | undefined>(new Date());
  const [daySheetData, setDaySheetData] = useState<DaySheetRow[]>([]);
  const [loadingDaySheet, setLoadingDaySheet] = useState(false);
  const [daySheetError, setDaySheetError] = useState<string | null>(null);
  const [daySheetTodayCredits, setDaySheetTodayCredits] = useState(0);
  const [daySheetTodayDebits, setDaySheetTodayDebits] = useState(0);


  useEffect(() => {
    const fetchData = async () => {
      setLoadingStats(true);
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        setUserCount(usersSnapshot.size);
        
        const groupsSnapshot = await getDocs(collection(db, "groups"));
        setGroupCount(groupsSnapshot.size);
        let active = 0;
        let closed = 0;
        for (const groupDoc of groupsSnapshot.docs) {
          const group = { id: groupDoc.id, ...groupDoc.data() } as Group;
          if (group.tenure && group.tenure > 0) {
            const auctionQuery = query(collection(db, "auctionRecords"), where("groupId", "==", group.id));
            const auctionSnapshot = await getDocs(auctionQuery);
            if (auctionSnapshot.size >= group.tenure) closed++; else active++;
          } else { active++; }
        }
        setActiveGroupCount(active);
        setClosedGroupCount(closed);
        
        const employeesSnapshot = await getDocs(collection(db, "employees"));
        setEmployeeCount(employeesSnapshot.size);

        let totalReceived = 0;
        let totalSent = 0;

        const collectionsSnapshot = await getDocs(collection(db, "collectionRecords"));
        let collectedSum = 0;
        collectionsSnapshot.forEach(doc => {
          const data = doc.data() as CollectionRecord;
          if (data.amount && typeof data.amount === 'number') {
            collectedSum += data.amount;
            totalReceived += data.amount;
          }
        });
        setTotalCollectionAmount(collectedSum);

        const creditSnapshot = await getDocs(collection(db, "creditRecords"));
        creditSnapshot.forEach(doc => {
          const data = doc.data() as CreditRecord;
          if (data.amount && typeof data.amount === 'number') totalReceived += data.amount;
        });

        const paymentsSnapshot = await getDocs(collection(db, "paymentRecords"));
        paymentsSnapshot.forEach(doc => {
          const data = doc.data() as PaymentRecord;
          if (data.amount && typeof data.amount === 'number') totalSent += data.amount;
        });

        const salarySnapshot = await getDocs(collection(db, "salaryRecords"));
        salarySnapshot.forEach(doc => {
          const data = doc.data() as SalaryRecord;
          if (data.amount && typeof data.amount === 'number') totalSent += data.amount;
        });

        const expensesSnapshot = await getDocs(collection(db, "expenses"));
        expensesSnapshot.forEach(doc => {
          const data = doc.data() as ExpenseRecord;
          if (data.amount && typeof data.amount === 'number') {
            if (data.type === 'spend') totalSent += data.amount;
            else if (data.type === 'received') totalReceived += data.amount;
          }
        });
        
        setCurrentBalance(totalReceived - totalSent);
        setTotalPenaltyAmount(0); 

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

  const generateDaySheetReport = async () => {
    if (!selectedDateForDaySheet) {
      setDaySheetError("Please select a date.");
      return;
    }
    setLoadingDaySheet(true);
    setDaySheetData([]);
    setDaySheetError(null);
    setDaySheetTodayCredits(0);
    setDaySheetTodayDebits(0);

    const targetDate = selectedDateForDaySheet;
    const startOfTargetDay = dateFnsStartOfDay(targetDate);
    const endOfTargetDay = dateFnsEndOfDay(targetDate);
    const formattedTargetDate = formatDateFns(targetDate, "yyyy-MM-dd");

    let openingBalance = 0;
    const dailyTransactions: DaySheetRow[] = [];
    let todayTotalCredits = 0;
    let todayTotalDebits = 0;

    try {
      // Calculate Opening Balance
      const collectionsBefore = await getDocs(query(collection(db, "collectionRecords"), where("recordedAt", "<", startOfTargetDay)));
      collectionsBefore.forEach(doc => openingBalance += (doc.data() as CollectionRecord).amount || 0);
      const creditsBefore = await getDocs(query(collection(db, "creditRecords"), where("recordedAt", "<", startOfTargetDay)));
      creditsBefore.forEach(doc => openingBalance += (doc.data() as CreditRecord).amount || 0);
      const expensesReceivedBefore = await getDocs(query(collection(db, "expenses"), where("type", "==", "received"), where("recordedAt", "<", startOfTargetDay)));
      expensesReceivedBefore.forEach(doc => openingBalance += (doc.data() as ExpenseRecord).amount || 0);
      
      const paymentsBefore = await getDocs(query(collection(db, "paymentRecords"), where("recordedAt", "<", startOfTargetDay)));
      paymentsBefore.forEach(doc => openingBalance -= (doc.data() as PaymentRecord).amount || 0);
      const salariesBefore = await getDocs(query(collection(db, "salaryRecords"), where("recordedAt", "<", startOfTargetDay)));
      salariesBefore.forEach(doc => openingBalance -= (doc.data() as SalaryRecord).amount || 0);
      const expensesSpendBefore = await getDocs(query(collection(db, "expenses"), where("type", "==", "spend"), where("recordedAt", "<", startOfTargetDay)));
      expensesSpendBefore.forEach(doc => openingBalance -= (doc.data() as ExpenseRecord).amount || 0);

      const tempTransactions: (DaySheetRow & { originalTimestamp: Date })[] = [];

      // Fetch today's transactions
      const collectionsToday = await getDocs(query(collection(db, "collectionRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      collectionsToday.forEach(doc => {
        const data = doc.data() as CollectionRecord;
        tempTransactions.push({ sno: 0, date: formattedTargetDate, particulars: `Collection from ${data.userFullname}`, credit: data.amount || 0, debit: 0, remarks: data.remarks || `Group: ${data.groupName}`, originalTimestamp: data.recordedAt.toDate() });
        todayTotalCredits += data.amount || 0;
      });

      const paymentsToday = await getDocs(query(collection(db, "paymentRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      paymentsToday.forEach(doc => {
        const data = doc.data() as PaymentRecord;
        tempTransactions.push({ sno: 0, date: formattedTargetDate, particulars: `Payment to ${data.userFullname}`, credit: 0, debit: data.amount || 0, remarks: data.remarks || `Group: ${data.groupName}`, originalTimestamp: data.recordedAt.toDate() });
        todayTotalDebits += data.amount || 0;
      });

      const salariesToday = await getDocs(query(collection(db, "salaryRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      salariesToday.forEach(doc => {
        const data = doc.data() as SalaryRecord;
        tempTransactions.push({ sno: 0, date: formattedTargetDate, particulars: `Salary to ${data.employeeName}`, credit: 0, debit: data.amount || 0, remarks: data.remarks || "Salary", originalTimestamp: data.recordedAt.toDate() });
        todayTotalDebits += data.amount || 0;
      });

      const creditsToday = await getDocs(query(collection(db, "creditRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      creditsToday.forEach(doc => {
        const data = doc.data() as CreditRecord;
        tempTransactions.push({ sno: 0, date: formattedTargetDate, particulars: `Credit from ${data.fromName}`, credit: data.amount || 0, debit: 0, remarks: data.remarks || `Credit No: ${data.creditNumber || 'N/A'}`, originalTimestamp: data.recordedAt.toDate() });
        todayTotalCredits += data.amount || 0;
      });

      const expensesToday = await getDocs(query(collection(db, "expenses"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      expensesToday.forEach(doc => {
        const data = doc.data() as ExpenseRecord;
        if (data.type === 'received') {
          tempTransactions.push({ sno: 0, date: formattedTargetDate, particulars: `Income: ${data.fromPerson}`, credit: data.amount || 0, debit: 0, remarks: data.remarks || "Received", originalTimestamp: data.recordedAt.toDate() });
          todayTotalCredits += data.amount || 0;
        } else { // spend
          tempTransactions.push({ sno: 0, date: formattedTargetDate, particulars: `Expense: ${data.reason}`, credit: 0, debit: data.amount || 0, remarks: data.remarks || "Spent", originalTimestamp: data.recordedAt.toDate() });
          todayTotalDebits += data.amount || 0;
        }
      });
      
      tempTransactions.sort((a, b) => a.originalTimestamp.getTime() - b.originalTimestamp.getTime());
      
      let currentSno = 1;
      const report: DaySheetRow[] = [];
      report.push({ sno: currentSno++, date: formattedTargetDate, particulars: "Opening Balance", credit: openingBalance > 0 ? openingBalance : 0, debit: openingBalance < 0 ? Math.abs(openingBalance) : 0, remarks: "" });
      
      tempTransactions.forEach(tx => {
        report.push({ ...tx, sno: currentSno++ });
      });
      
      const closingBalance = openingBalance + todayTotalCredits - todayTotalDebits;
      report.push({ sno: currentSno, date: formattedTargetDate, particulars: "Closing Balance", credit: 0, debit: 0, remarks: `Final balance ${formatCurrency(closingBalance)}` });
      
      setDaySheetData(report);
      setDaySheetTodayCredits(todayTotalCredits);
      setDaySheetTodayDebits(todayTotalDebits);

    } catch (err) {
      console.error("Error generating day sheet:", err);
      setDaySheetError("Failed to generate report. Check Firestore indexes and data.");
    } finally {
      setLoadingDaySheet(false);
    }
  };


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
            {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{userCount}</div>}
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Layers className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : (
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
            {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{employeeCount}</div>}
            <p className="text-xs text-muted-foreground">Registered employees</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{formatCurrency(totalCollectionAmount)}</div>}
            <p className="text-xs text-muted-foreground">From customer collections</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Penalty</CardTitle>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{formatCurrency(totalPenaltyAmount)}</div>}
            <p className="text-xs text-muted-foreground">Total penalties collected</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{formatCurrency(currentBalance)}</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sheet className="h-6 w-6 text-primary"/> Day Sheet Report</CardTitle>
          <CardDescription>Generate a ledger report for a specific day.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="w-[280px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDateForDaySheet ? formatDateFns(selectedDateForDaySheet, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDateForDaySheet}
                  onSelect={setSelectedDateForDaySheet}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button onClick={generateDaySheetReport} disabled={loadingDaySheet || !selectedDateForDaySheet}>
              {loadingDaySheet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Report
            </Button>
          </div>

          {daySheetError && (
            <div className="text-destructive p-4 border border-destructive/50 rounded-md">{daySheetError}</div>
          )}

          {daySheetData.length > 0 && (
            <div className="overflow-x-auto rounded-md border mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">S.No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daySheetData.map((row) => (
                    <TableRow key={row.sno} className={row.particulars.includes("Balance") ? "font-bold bg-secondary/50" : ""}>
                      <TableCell>{row.sno}</TableCell>
                      <TableCell>{formatDateFns(new Date(row.date.replace(/-/g, '/')), "dd-MM-yyyy")}</TableCell>
                      <TableCell>{row.particulars}</TableCell>
                      <TableCell className="text-right font-mono">{row.credit > 0 ? formatCurrency(row.credit) : "-"}</TableCell>
                      <TableCell className="text-right font-mono">{row.debit > 0 ? formatCurrency(row.debit) : "-"}</TableCell>
                      <TableCell>{row.remarks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                   <TableRow className="font-bold bg-muted/80">
                        <TableCell colSpan={3} className="text-right">Total for the Day:</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(daySheetTodayCredits)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(daySheetTodayDebits)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
