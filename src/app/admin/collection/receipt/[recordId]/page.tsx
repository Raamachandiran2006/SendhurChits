
"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { CollectionRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download as DownloadIcon, ArrowLeft, Eye } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString: string | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString.replace(/-/g, '/'));
    if (isNaN(date.getTime())) {
        const isoDate = new Date(dateString);
        if (isNaN(isoDate.getTime())) return "N/A";
        return format(isoDate, outputFormat);
    }
    return format(date, outputFormat);
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "N/A";
  }
};

export default function AdminCollectionReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.recordId as string;

  const [receipt, setReceipt] = useState<CollectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recordId) {
      const fetchReceipt = async () => {
        setLoading(true);
        setError(null);
        try {
          const docRef = doc(db, "collectionRecords", recordId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setReceipt({ id: docSnap.id, ...docSnap.data() } as CollectionRecord);
          } else {
            setError("Receipt not found.");
          }
        } catch (err) {
          console.error("Error fetching receipt:", err);
          setError("Failed to load receipt details.");
        } finally {
          setLoading(false);
        }
      };
      fetchReceipt();
    }
  }, [recordId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!receipt) return;

    if (receipt.receiptPdfUrl) {
      const link = document.createElement('a');
      link.href = receipt.receiptPdfUrl;
      link.download = `receipt_${receipt.receiptNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200] 
    });
    let y = 10;
    const lineHeight = 6;
    const margin = 5;

    doc.setFontSize(12);
    doc.text(receipt.companyName || "Sendhur Chits", margin, y); y += lineHeight * 1.5;
    doc.setFontSize(8);
    doc.text("----------------------------------------", margin, y); y += lineHeight;
    
    doc.text(`Receipt No: ${receipt.receiptNumber}`, margin, y); y += lineHeight;
    doc.text(`Date: ${formatDate(receipt.paymentDate)} ${receipt.paymentTime}`, margin, y); y += lineHeight;
    doc.text("----------------------------------------", margin, y); y += lineHeight;
    
    doc.text(`Group: ${receipt.groupName} (ID: ${receipt.groupId})`, margin, y); y += lineHeight;
    doc.text(`Member: ${receipt.userFullname} (@${receipt.userUsername})`, margin, y); y += lineHeight;
    if (receipt.dueNumber) {
         doc.text(`Due No: ${receipt.dueNumber}`, margin, y); y += lineHeight;
    }
    if (receipt.chitAmount !== null && receipt.chitAmount !== undefined) {
        doc.text(`Installment Amount: ${formatCurrency(receipt.chitAmount)}`, margin, y); y += lineHeight;
    }
    doc.setFontSize(10);
    doc.text(`Paid Amount: ${formatCurrency(receipt.amount)}`, margin, y, {fontStyle: 'bold'}); y += lineHeight;
    doc.setFontSize(8);
    if (receipt.userTotalDueBeforeThisPayment !== null && receipt.userTotalDueBeforeThisPayment !== undefined) {
        doc.text(`Total Balance: ${formatCurrency(receipt.userTotalDueBeforeThisPayment)}`, margin, y); y += lineHeight;
    }
    doc.text(`Payment Mode: ${receipt.paymentMode}`, margin, y); y += lineHeight;
    doc.text("----------------------------------------", margin, y); y += lineHeight;
    if(receipt.remarks) {
        doc.text(`Remarks: ${receipt.remarks}`, margin, y); y += lineHeight;
    }
    doc.text(`Virtual ID: ${receipt.virtualTransactionId || 'N/A'}`, margin, y); y += lineHeight;
    doc.text("----------------------------------------", margin, y); y += lineHeight;
    doc.text("Thank You!", margin, y, {align: 'center'});
    
    doc.save(`receipt_${receipt.receiptNumber}.pdf`);
  };

  const handleViewUserDues = () => {
    if (receipt && receipt.userId) {
      router.push(`/admin/users/${receipt.userId}#due-sheet`);
    } else {
      router.push('/admin/collection'); 
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p>Receipt not found.</p>
         <Button onClick={() => router.back()} variant="outline" className="mt-4">
           <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div id="receipt-content-wrapper" className="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4 print:bg-white print:p-0 print:m-0">
      <div id="printable-receipt-area">
        <div className="w-full max-w-xs bg-white shadow-lg print:shadow-none print:w-auto print:m-0 print:border-none print:p-0 print:p-0" id="receipt-content">
          <div className="text-center mb-2 print:mb-1">
            <h1 className="text-xl font-bold print:text-lg">{receipt.companyName || "Sendhur Chits"}</h1>
            <p className="text-sm print:text-xs">Payment Receipt</p>
          </div>
          <div className="text-xs space-y-1 border-t border-b border-dashed border-gray-400 py-2 my-2 print:py-1 print:my-1 print:border-gray-700">
            <p><strong>Receipt No:</strong> {receipt.receiptNumber}</p>
            <p><strong>Date:</strong> {formatDate(receipt.paymentDate)} {receipt.paymentTime}</p>
          </div>
          <div className="text-xs space-y-1 mb-2 print:mb-1">
            <p><strong>Group:</strong> {receipt.groupName} (ID: {receipt.groupId})</p>
            <p><strong>Member:</strong> {receipt.userFullname} (@{receipt.userUsername})</p>
            {receipt.dueNumber && <p><strong>Due No:</strong> {receipt.dueNumber}</p>}
            {receipt.chitAmount !== null && receipt.chitAmount !== undefined && (
              <p><strong>Installment Amount:</strong> {formatCurrency(receipt.chitAmount)}</p>
            )}
            <p className="font-bold text-sm print:text-base"><strong>Paid Amount:</strong> {formatCurrency(receipt.amount)}</p>
            {receipt.userTotalDueBeforeThisPayment !== null && receipt.userTotalDueBeforeThisPayment !== undefined && (
              <p><strong>Total Balance:</strong> {formatCurrency(receipt.userTotalDueBeforeThisPayment)}</p>
            )}
            <p><strong>Payment Mode:</strong> {receipt.paymentMode}</p>
          </div>
          <div className="text-xs space-y-1 border-t border-dashed border-gray-400 pt-2 mt-2 print:pt-1 print:mt-1 print:border-gray-700">
            {receipt.remarks && <p><strong>Remarks:</strong> {receipt.remarks}</p>}
            {receipt.virtualTransactionId && <p><strong>Virtual ID:</strong> {receipt.virtualTransactionId}</p>}
            <p className="text-center mt-2 print:mt-1">Thank You!</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex space-x-3 print:hidden">
        <Button onClick={handleViewUserDues} variant="outline">
            <Eye className="mr-2 h-4 w-4"/> View User Dues
        </Button>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
        <Button onClick={handleDownloadPdf}>
          <DownloadIcon className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>

      <style jsx global>{`
        @media print {
          body, html {
            width: 72mm !important;
            height: auto !important; /* Allow height to be determined by content */
            min-height: 0 !important; /* Allow height to be determined by content */
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important; /* Allow content to flow if longer than one page */
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body > *:not(#receipt-content-wrapper) { /* Hide everything not explicitly part of the printable area */
            display: none !important;
            visibility: hidden !important;
          }
          
          #receipt-content-wrapper { /* The direct parent of printable-receipt-area */
            display: block !important;
            visibility: visible !important;
            width: 72mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            position: static !important; 
          }

          #printable-receipt-area { /* The area containing the receipt content div */
            display: block !important;
            visibility: visible !important;
            width: 72mm !important;
            height: auto !important; 
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            box-sizing: border-box !important;
          }
          
          #printable-receipt-area * {
            visibility: visible !important;
            display: revert !important;
            color: black !important;
            background-color: transparent !important;
          }

          #printable-receipt-area #receipt-content {
            width: 100% !important; 
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
            color: black !important;
            background-color: white !important;
            padding: 1mm 2mm !important; 
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }

          #printable-receipt-area #receipt-content h1,
          #printable-receipt-area #receipt-content p,
          #printable-receipt-area #receipt-content div {
            margin-top: 0.5mm !important;
            margin-bottom: 0.5mm !important;
            font-size: 8pt !important;
            page-break-inside: avoid !important;
          }
          #printable-receipt-area #receipt-content .border-dashed {
            padding-top: 0.5mm !important;
            padding-bottom: 0.5mm !important;
          }
          
          .firebase-emulator-warning,
          iframe[id^="webpack-dev-server-client-overlay"],
          div[id^="__next_error"],
          div[class*="next-error-overlay"] {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}
    

    