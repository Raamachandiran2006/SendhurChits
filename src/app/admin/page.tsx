
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Users, Layers, Briefcase, TrendingUp, Loader2, AlertTriangle, Banknote, Wallet, CalendarIcon as CalendarIconLucide, Sheet, Download } from "lucide-react"; // Added Sheet and Download
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Group, CollectionRecord, PaymentRecord, SalaryRecord, ExpenseRecord, CreditRecord, DaySheetRow } from "@/types";
import { format as formatDateFns, startOfDay as dateFnsStartOfDay, endOfDay as dateFnsEndOfDay } from "date-fns";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from "@/hooks/use-toast";

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
  const [isDownloadingDaySheetPdf, setIsDownloadingDaySheetPdf] = useState(false);
  const { toast } = useToast();


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

  const generateDaySheetData = async (targetDate: Date): Promise<{ 
    reportRows: DaySheetRow[], 
    todayCredits: number, 
    todayDebits: number,
    openingBalance: number,
    closingBalance: number
  } | { error: string }> => {
    const startOfTargetDay = dateFnsStartOfDay(targetDate);
    const endOfTargetDay = dateFnsEndOfDay(targetDate);
    const formattedTargetDate = formatDateFns(targetDate, "yyyy-MM-dd");

    let openingBalance = 0;
    let todayTransactions: DaySheetRow[] = [];
    let todayTotalCredits = 0;
    let todayTotalDebits = 0;

    try {
      // Calculate Opening Balance
      const collectionsBeforeSnap = await getDocs(query(collection(db, "collectionRecords"), where("recordedAt", "<", startOfTargetDay)));
      collectionsBeforeSnap.forEach(doc => openingBalance += (doc.data() as CollectionRecord).amount || 0);
      
      const creditsBeforeSnap = await getDocs(query(collection(db, "creditRecords"), where("recordedAt", "<", startOfTargetDay)));
      creditsBeforeSnap.forEach(doc => openingBalance += (doc.data() as CreditRecord).amount || 0);
      
      const expensesReceivedBeforeSnap = await getDocs(query(collection(db, "expenses"), where("type", "==", "received"), where("recordedAt", "<", startOfTargetDay)));
      expensesReceivedBeforeSnap.forEach(doc => openingBalance += (doc.data() as ExpenseRecord).amount || 0);
      
      const paymentsBeforeSnap = await getDocs(query(collection(db, "paymentRecords"), where("recordedAt", "<", startOfTargetDay)));
      paymentsBeforeSnap.forEach(doc => openingBalance -= (doc.data() as PaymentRecord).amount || 0);
      
      const salariesBeforeSnap = await getDocs(query(collection(db, "salaryRecords"), where("recordedAt", "<", startOfTargetDay)));
      salariesBeforeSnap.forEach(doc => openingBalance -= (doc.data() as SalaryRecord).amount || 0);
      
      const expensesSpendBeforeSnap = await getDocs(query(collection(db, "expenses"), where("type", "==", "spend"), where("recordedAt", "<", startOfTargetDay)));
      expensesSpendBeforeSnap.forEach(doc => openingBalance -= (doc.data() as ExpenseRecord).amount || 0);

      // Fetch Today's Transactions
      const collectionsTodaySnap = await getDocs(query(collection(db, "collectionRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      collectionsTodaySnap.forEach(doc => {
        const data = doc.data() as CollectionRecord;
        const transaction: DaySheetRow = {
          sno: 0, date: formattedTargetDate, particulars: "Collection",
          credit: data.amount || 0, debit: 0,
          remarks: `From ${data.userFullname} (${data.groupName})`,
          _timestamp: data.recordedAt.toDate()
        };
        todayTransactions.push(transaction);
        todayTotalCredits += transaction.credit;
      });

      const paymentsTodaySnap = await getDocs(query(collection(db, "paymentRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      paymentsTodaySnap.forEach(doc => {
        const data = doc.data() as PaymentRecord;
        const transaction: DaySheetRow = {
          sno: 0, date: formattedTargetDate, particulars: "Payment to User",
          credit: 0, debit: data.amount || 0,
          remarks: `To ${data.userFullname} (Auction: ${data.auctionNumber || 'N/A'})`,
          _timestamp: data.recordedAt.toDate()
        };
        todayTransactions.push(transaction);
        todayTotalDebits += transaction.debit;
      });

      const salariesTodaySnap = await getDocs(query(collection(db, "salaryRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      salariesTodaySnap.forEach(doc => {
        const data = doc.data() as SalaryRecord;
        const transaction: DaySheetRow = {
          sno: 0, date: formattedTargetDate, particulars: "Salary Paid",
          credit: 0, debit: data.amount || 0,
          remarks: `To ${data.employeeName}`,
          _timestamp: data.recordedAt.toDate()
        };
        todayTransactions.push(transaction);
        todayTotalDebits += transaction.debit;
      });
      
      const otherCreditsTodaySnap = await getDocs(query(collection(db, "creditRecords"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      otherCreditsTodaySnap.forEach(doc => {
        const data = doc.data() as CreditRecord;
         const transaction: DaySheetRow = {
          sno: 0, date: formattedTargetDate, particulars: "Other Credit",
          credit: data.amount || 0, debit: 0,
          remarks: `From ${data.fromName} (Credit No: ${data.creditNumber || 'N/A'})`,
          _timestamp: data.recordedAt.toDate()
        };
        todayTransactions.push(transaction);
        todayTotalCredits += transaction.credit;
      });

      const expensesTodaySnap = await getDocs(query(collection(db, "expenses"), where("recordedAt", ">=", startOfTargetDay), where("recordedAt", "<=", endOfTargetDay)));
      expensesTodaySnap.forEach(doc => {
        const data = doc.data() as ExpenseRecord;
        if (data.type === 'spend') {
          const transaction: DaySheetRow = {
            sno: 0, date: formattedTargetDate, particulars: "Expense (Spend)",
            credit: 0, debit: data.amount || 0,
            remarks: data.reason || "General Expense",
            _timestamp: data.recordedAt.toDate()
          };
          todayTransactions.push(transaction);
          todayTotalDebits += transaction.debit;
        } else if (data.type === 'received') {
          const transaction: DaySheetRow = {
            sno: 0, date: formattedTargetDate, particulars: "Expense (Received)",
            credit: data.amount || 0, debit: 0,
            remarks: data.fromPerson || "General Income",
            _timestamp: data.recordedAt.toDate()
          };
          todayTransactions.push(transaction);
          todayTotalCredits += transaction.credit;
        }
      });

      todayTransactions.sort((a, b) => (a._timestamp?.getTime() || 0) - (b._timestamp?.getTime() || 0));

      const report: DaySheetRow[] = [];
      let currentSno = 1;
      report.push({ sno: currentSno++, date: formattedTargetDate, particulars: "Opening Balance", credit: openingBalance > 0 ? openingBalance : 0, debit: openingBalance < 0 ? Math.abs(openingBalance) : 0, remarks: "" });
      
      todayTransactions.forEach(tx => {
        report.push({ ...tx, sno: currentSno++ });
      });
      
      const closingBalance = openingBalance + todayTotalCredits - todayTotalDebits;
      report.push({ sno: currentSno, date: formattedTargetDate, particulars: "Closing Balance", credit: 0, debit: 0, remarks: `Final balance ${formatCurrency(closingBalance)}` });
      
      return { reportRows: report, todayCredits: todayTotalCredits, todayDebits: todayTotalDebits, openingBalance, closingBalance };

    } catch (err) {
      console.error("Error generating day sheet data:", err);
      return { error: "Failed to generate report data. Check Firestore indexes and data." };
    }
  };

  const handleDownloadDaySheetPdf = async () => {
    if (!selectedDateForDaySheet) {
      toast({
        title: "Date Required",
        description: "Please select a date for the Day Sheet report.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloadingDaySheetPdf(true);

    const result = await generateDaySheetData(selectedDateForDaySheet);

    if ('error' in result) {
      toast({
        title: "Report Generation Failed",
        description: result.error,
        variant: "destructive",
      });
      setIsDownloadingDaySheetPdf(false);
      return;
    }

    const { reportRows, todayCredits, todayDebits, openingBalance, closingBalance } = result;

    if (reportRows.length === 0) {
      toast({
        title: "No Data",
        description: "No transactions found for the selected date.",
        variant: "default"
      });
      setIsDownloadingDaySheetPdf(false);
      return;
    }
    
    const doc = new jsPDF();
    const tableColumn = ["S.No", "Date", "Particulars", "Credit (Rs.)", "Debit (Rs.)", "Remarks"];
    const tableRows: any[][] = [];

    const formatCurrencyPdf = (amount: number | null | undefined) => {
      if (amount === null || amount === undefined || isNaN(amount) || amount === 0) return "-";
      return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    reportRows.forEach((row) => {
       const rowData = [
        row.sno,
        formatDateFns(new Date(row.date.replace(/-/g, '/')), "dd-MM-yyyy"),
        row.particulars,
        formatCurrencyPdf(row.credit),
        formatCurrencyPdf(row.debit),
        row.remarks || "",
      ];
      tableRows.push(rowData);
    });
    
    // Add totals row for the day's transactions
    tableRows.splice(tableRows.length -1, 0, [ // Insert before closing balance
        {content: "Total for the Day:", colSpan: 3, styles: {halign: 'right', fontStyle: 'bold'}},
        {content: formatCurrencyPdf(todayCredits), styles: {halign: 'right', fontStyle: 'bold'}},
        {content: formatCurrencyPdf(todayDebits), styles: {halign: 'right', fontStyle: 'bold'}},
        {content: "", styles: {fontStyle: 'bold'}},
    ]);


    doc.setFontSize(18);
    doc.text(`Day Sheet Report for ${formatDateFns(selectedDateForDaySheet, "PPP")}`, 14, 20);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [30, 144, 255] }, 
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 
        0: { cellWidth: 10 }, // S.No
        1: { cellWidth: 20 }, // Date
        2: { cellWidth: 'auto' }, // Particulars
        3: { halign: 'right', cellWidth: 25 }, // Credit
        4: { halign: 'right', cellWidth: 25 }, // Debit
        5: { cellWidth: 'auto' }, // Remarks
      },
      didParseCell: function (data) {
        // Style Opening and Closing Balance rows
        const particulars = data.row.raw[2]?.content?.toString();
        if (particulars === "Opening Balance" || particulars === "Closing Balance") {
          data.cell.styles.fontStyle = 'bold';
          if (particulars === "Opening Balance") { // Opening balance amount
            data.cell.styles.fillColor = data.column.index === 3 && openingBalance > 0 ? [230, 245, 255] : (data.column.index === 4 && openingBalance < 0 ? [255,230,230] : undefined);
          }
        }
      }
    });

    doc.save(`DaySheet_${formatDateFns(selectedDateForDaySheet, "yyyy-MM-dd")}.pdf`);
    setIsDownloadingDaySheetPdf(false);
     toast({
        title: "PDF Generated",
        description: "Day Sheet report has been downloaded.",
      });
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
          <CardDescription>Generate a summarized ledger report for a specific day.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="w-full sm:w-[280px] justify-start text-left font-normal"
                >
                  <CalendarIconLucide className="mr-2 h-4 w-4" />
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
            <Button onClick={handleDownloadDaySheetPdf} disabled={isDownloadingDaySheetPdf || !selectedDateForDaySheet}>
              {isDownloadingDaySheetPdf && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    