
"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { CollectionRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download as DownloadIcon, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString: string | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString.replace(/-/g, '/')); // More robust parsing
    return format(date, outputFormat);
  } catch (e) {
    return "N/A";
  }
};

export default function CollectionReceiptPage() {
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
      // If a stored PDF URL exists, use it for direct download
      const link = document.createElement('a');
      link.href = receipt.receiptPdfUrl;
      link.download = `receipt_${receipt.receiptNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Fallback: Generate PDF on the client if no stored URL (for older records)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200] 
    });
    let y = 10;
    const lineHeight = 7;
    const margin = 5;

    doc.setFontSize(12);
    doc.text(receipt.companyName, margin, y); y += lineHeight * 1.5;
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
    if (receipt.balanceAmount !== null && receipt.balanceAmount !== undefined) {
        doc.text(`Balance Due (this inst.): ${formatCurrency(receipt.balanceAmount)}`, margin, y); y += lineHeight;
    }
    doc.text(`Payment Mode: ${receipt.paymentMode}`, margin, y); y += lineHeight;
    doc.text("----------------------------------------", margin, y); y += lineHeight;
    doc.text(`Collected By: ${receipt.recordedByEmployeeName}`, margin, y); y += lineHeight;
    if(receipt.remarks) {
        doc.text(`Remarks: ${receipt.remarks}`, margin, y); y += lineHeight;
    }
    doc.text(`Virtual ID: ${receipt.virtualTransactionId || 'N/A'}`, margin, y); y += lineHeight;
    doc.text("----------------------------------------", margin, y); y += lineHeight;
    doc.text("Thank You!", margin, y, {align: 'center'});
    
    doc.save(`receipt_${receipt.receiptNumber}.pdf`);
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
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4 print:bg-white print:p-0">
      <div className="w-full max-w-xs bg-white p-6 shadow-lg print:shadow-none print:w-auto" id="receipt-content">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold">{receipt.companyName}</h1>
          <p className="text-sm">Payment Receipt</p>
        </div>
        <div className="text-xs space-y-1 border-t border-b border-dashed border-gray-400 py-2 my-2">
          <p><strong>Receipt No:</strong> {receipt.receiptNumber}</p>
          <p><strong>Date:</strong> {formatDate(receipt.paymentDate)} {receipt.paymentTime}</p>
        </div>
        <div className="text-xs space-y-1 mb-2">
          <p><strong>Group:</strong> {receipt.groupName} (ID: {receipt.groupId})</p>
          <p><strong>Member:</strong> {receipt.userFullname} (@{receipt.userUsername})</p>
           {receipt.dueNumber && <p><strong>Due No:</strong> {receipt.dueNumber}</p>}
          {receipt.chitAmount !== null && receipt.chitAmount !== undefined && (
            <p><strong>Installment Amount:</strong> {formatCurrency(receipt.chitAmount)}</p>
          )}
          <p className="font-bold text-sm"><strong>Paid Amount:</strong> {formatCurrency(receipt.amount)}</p>
          {receipt.balanceAmount !== null && receipt.balanceAmount !== undefined && (
            <p><strong>Balance Due (this inst.):</strong> {formatCurrency(receipt.balanceAmount)}</p>
          )}
          <p><strong>Payment Mode:</strong> {receipt.paymentMode}</p>
        </div>
        <div className="text-xs space-y-1 border-t border-dashed border-gray-400 pt-2 mt-2">
          <p><strong>Collected By:</strong> {receipt.recordedByEmployeeName}</p>
          {receipt.remarks && <p><strong>Remarks:</strong> {receipt.remarks}</p>}
          {receipt.virtualTransactionId && <p><strong>Virtual ID:</strong> {receipt.virtualTransactionId}</p>}
          <p className="text-center mt-2">Thank You!</p>
        </div>
      </div>

      <div className="mt-6 flex space-x-3 print:hidden">
        <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4"/> Back to Form
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
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:w-auto { width: auto !important; }
          #receipt-content {
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 9pt !important;
            line-height: 1.3 !important;
            color: black !important;
            max-width: 80mm !important;
            margin: auto;
          }
          #receipt-content p, #receipt-content h1 {
            margin-bottom: 2px !important;
          }
        }
      `}</style>
    </div>
  );
}
