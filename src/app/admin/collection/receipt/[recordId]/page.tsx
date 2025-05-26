
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
    if (!receipt) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>
          @media print {
            @page {
              margin: 0;
              size: 72mm auto; /* Attempt to control paper size, auto height */
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 72mm !important; /* Strict width for thermal printer */
              font-family: 'Courier New', Courier, monospace !important; /* Monospace font often works best */
              font-size: 10pt !important; /* Slightly increased font size */
              line-height: 1.3 !important;
              color: black !important;
              background-color: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .receipt-print-content {
              padding: 2mm !important; /* Minimal internal padding */
              width: 100% !important;
              box-sizing: border-box !important;
            }
            .center {
              text-align: center !important;
            }
            .bold {
              font-weight: bold !important;
            }
            hr {
              border: none !important;
              border-top: 1px dashed black !important;
              margin: 1mm 0 !important;
            }
            p, div.section-item {
              margin: 0.5mm 0 !important; /* Reduced vertical spacing */
              padding: 0 !important;
              font-size: 10pt !important;
            }
            h1, h2, h3, h4, h5, h6 {
                margin: 0.5mm 0 !important;
                font-size: 10pt !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-print-content">
          <div class="center bold section-item">${receipt.companyName || "Sendhur Chits"}</div>
          <div class="center section-item">Receipt No: ${receipt.receiptNumber || 'N/A'}</div>
          <div class="center section-item">Date: ${formatDate(receipt.paymentDate, "dd-MMM-yyyy")} ${receipt.paymentTime || ''}</div>
          <hr>
          <div class="section-item"><strong>Group:</strong> ${receipt.groupName || 'N/A'} ${receipt.groupId ? `(ID: ${receipt.groupId})` : ''}</div>
          <div class="section-item"><strong>User:</strong> ${receipt.userFullname || 'N/A'} ${receipt.userUsername ? `(@${receipt.userUsername})` : ''}</div>
          ${receipt.dueNumber ? `<div class="section-item"><strong>Due No.:</strong> ${receipt.dueNumber}</div>` : ''}
          ${receipt.chitAmount !== null && receipt.chitAmount !== undefined ? `<div class="section-item"><strong>Installment:</strong> ${formatCurrency(receipt.chitAmount)}</div>` : ''}
          <div class="section-item bold"><strong>Paid:</strong> ${formatCurrency(receipt.amount)}</div>
          ${receipt.userTotalDueBeforeThisPayment !== null && receipt.userTotalDueBeforeThisPayment !== undefined ? `<div class="section-item"><strong>Total Balance:</strong> ${formatCurrency(receipt.userTotalDueBeforeThisPayment)}</div>` : ''}
          <div class="section-item"><strong>Mode:</strong> ${receipt.paymentMode || 'N/A'}</div>
          ${receipt.remarks && receipt.remarks.trim() !== "" ? `<div class="section-item"><strong>Remarks:</strong> ${receipt.remarks}</div>` : ''}
          <hr>
          <div class="center section-item">Thank You!</div>
        </div>
      </body>
      </html>
    `;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(receiptHTML);
      frameDoc.close();
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    }
    // Optionally remove the iframe after a delay
    setTimeout(() => {
      document.body.removeChild(printFrame);
    }, 1000);
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

    // Fallback PDF generation if URL is not available
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [72, 200] // Adjusted for 72mm width, height can be auto
    });
    let y = 10;
    const lineHeight = 6; 
    const margin = 3; 

    doc.setFontSize(10); 
    doc.setFont('Courier', 'bold');
    doc.text(receipt.companyName || "Sendhur Chits", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); y += lineHeight * 1.5;
    
    doc.setFont('Courier', 'normal');
    doc.setFontSize(8);
    doc.text(`Receipt No: ${receipt.receiptNumber || 'N/A'}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); y += lineHeight;
    doc.text(`Date: ${formatDate(receipt.paymentDate, "dd-MMM-yyyy")} ${receipt.paymentTime || ''}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); y += lineHeight;
    
    doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y); y += lineHeight * 0.5; 
    
    y += lineHeight * 0.5;
    doc.text(`Group: ${receipt.groupName || 'N/A'} ${receipt.groupId ? `(ID: ${receipt.groupId})` : ''}`, margin, y); y += lineHeight;
    doc.text(`User: ${receipt.userFullname || 'N/A'} ${receipt.userUsername ? `(@${receipt.userUsername})` : ''}`, margin, y); y += lineHeight;
    if (receipt.dueNumber) {
         doc.text(`Due No.: ${receipt.dueNumber}`, margin, y); y += lineHeight;
    }
    if (receipt.chitAmount !== null && receipt.chitAmount !== undefined) {
        doc.text(`Installment: ${formatCurrency(receipt.chitAmount)}`, margin, y); y += lineHeight;
    }
    doc.setFont('Courier', 'bold');
    doc.setFontSize(9);
    doc.text(`Paid: ${formatCurrency(receipt.amount)}`, margin, y); y += lineHeight;
    doc.setFont('Courier', 'normal');
    doc.setFontSize(8);
    if (receipt.userTotalDueBeforeThisPayment !== null && receipt.userTotalDueBeforeThisPayment !== undefined) {
        doc.text(`Total Balance: ${formatCurrency(receipt.userTotalDueBeforeThisPayment)}`, margin, y); y += lineHeight;
    }
    doc.text(`Mode: ${receipt.paymentMode || 'N/A'}`, margin, y); y += lineHeight;
     if (receipt.remarks && receipt.remarks.trim() !== "") {
      doc.text(`Remarks: ${receipt.remarks}`, margin, y); y += lineHeight;
    }
    
    doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y); y += lineHeight * 0.5;
    
    y += lineHeight;
    doc.setFontSize(9);
    doc.text("Thank You!", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    
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

  // Screen display (remains the same)
  return (
    <div id="printable-receipt-area" className="flex flex-col items-center justify-start min-h-screen bg-background p-4 print:bg-white print:p-0">
      <div id="receipt-content" className="w-full max-w-xs bg-white p-6 shadow-lg print:shadow-none print:p-0 print:border-none">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold">{receipt.companyName || "Sendhur Chits"}</h1>
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
          {receipt.userTotalDueBeforeThisPayment !== null && receipt.userTotalDueBeforeThisPayment !== undefined && (
            <p><strong>Total Balance:</strong> {formatCurrency(receipt.userTotalDueBeforeThisPayment)}</p>
          )}
          <p><strong>Payment Mode:</strong> {receipt.paymentMode}</p>
        </div>
        <div className="text-xs space-y-1 border-t border-dashed border-gray-400 pt-2 mt-2">
          {receipt.remarks && <p><strong>Remarks:</strong> {receipt.remarks}</p>}
          {receipt.virtualTransactionId && <p><strong>Virtual ID:</strong> {receipt.virtualTransactionId}</p>}
          <p className="text-center mt-4">Thank You!</p>
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
    </div>
  );
}
    
