
"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { CollectionRecord, Group, AuctionRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, ArrowLeft, Eye } from 'lucide-react';
import { format } from 'date-fns';

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

  const [amountDueForThisInstallment, setAmountDueForThisInstallment] = useState<number | null>(null);
  const [totalPaidForThisDue, setTotalPaidForThisDue] = useState<number | null>(null);
  const [balanceForThisInstallment, setBalanceForThisInstallment] = useState<number | null>(null);


  useEffect(() => {
    if (recordId) {
      const fetchReceiptAndRelatedData = async () => {
        setLoading(true);
        setError(null);
        try {
          const docRef = doc(db, "collectionRecords", recordId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const collectionData = { id: docSnap.id, ...docSnap.data() } as CollectionRecord;
            
            if (collectionData.groupId) {
              const groupDocRef = doc(db, "groups", collectionData.groupId);
              const groupSnap = await getDoc(groupDocRef);
              if (groupSnap.exists()) {
                collectionData.groupTotalAmount = (groupSnap.data() as Group).totalAmount;
              }
            }

            if (collectionData.auctionId) {
              const auctionDocRef = doc(db, "auctionRecords", collectionData.auctionId);
              const auctionSnap = await getDoc(auctionDocRef);
              if (auctionSnap.exists()) {
                collectionData.auctionDateForReceipt = (auctionSnap.data() as AuctionRecord).auctionDate;
              }
            } else if (collectionData.groupId && collectionData.auctionNumber !== null && collectionData.auctionNumber !== undefined) {
               const auctionQuery = query(
                collection(db, "auctionRecords"),
                where("groupId", "==", collectionData.groupId),
                where("auctionNumber", "==", collectionData.auctionNumber)
              );
              const auctionSnapshot = await getDocs(auctionQuery);
              if (!auctionSnapshot.empty) {
                collectionData.auctionDateForReceipt = (auctionSnapshot.docs[0].data() as AuctionRecord).auctionDate;
              }
            }
            
            let fetchedAmountDueForThisInstallment: number | null = collectionData.chitAmount || null;
             if (fetchedAmountDueForThisInstallment === null && collectionData.auctionId) {
                const auctionDocRef = doc(db, "auctionRecords", collectionData.auctionId);
                const auctionSnap = await getDoc(auctionDocRef);
                if (auctionSnap.exists()) {
                    const auctionData = auctionSnap.data() as AuctionRecord;
                    if (auctionData.finalAmountToBePaid !== null && auctionData.finalAmountToBePaid !== undefined) {
                        fetchedAmountDueForThisInstallment = auctionData.finalAmountToBePaid;
                    }
                }
            } else if (fetchedAmountDueForThisInstallment === null && collectionData.groupId && collectionData.auctionNumber !== null && collectionData.auctionNumber !== undefined) {
                 const auctionQuery = query(
                    collection(db, "auctionRecords"),
                    where("groupId", "==", collectionData.groupId),
                    where("auctionNumber", "==", collectionData.auctionNumber)
                );
                const auctionSnapshot = await getDocs(auctionQuery);
                if (!auctionSnapshot.empty) {
                    const auctionData = auctionSnapshot.docs[0].data() as AuctionRecord;
                     if (auctionData.finalAmountToBePaid !== null && auctionData.finalAmountToBePaid !== undefined) {
                        fetchedAmountDueForThisInstallment = auctionData.finalAmountToBePaid;
                    }
                }
            }


            setAmountDueForThisInstallment(fetchedAmountDueForThisInstallment);
            

            if (collectionData.userId && collectionData.groupId && collectionData.auctionNumber !== null && collectionData.auctionNumber !== undefined) {
              const collectionsForDueQuery = query(
                collection(db, "collectionRecords"),
                where("userId", "==", collectionData.userId),
                where("groupId", "==", collectionData.groupId),
                where("auctionNumber", "==", collectionData.auctionNumber)
              );
              const collectionsForDueSnapshot = await getDocs(collectionsForDueQuery);
              let sumPaidForDue = 0;
              collectionsForDueSnapshot.forEach(snap => {
                sumPaidForDue += (snap.data() as CollectionRecord).amount || 0;
              });
              setTotalPaidForThisDue(sumPaidForDue);

              if (fetchedAmountDueForThisInstallment !== null) {
                setBalanceForThisInstallment(fetchedAmountDueForThisInstallment - sumPaidForDue);
              } else {
                setBalanceForThisInstallment(null);
              }
            } else {
              setTotalPaidForThisDue(collectionData.amount); 
              if (fetchedAmountDueForThisInstallment !== null) {
                 setBalanceForThisInstallment(fetchedAmountDueForThisInstallment - (collectionData.amount || 0));
              } else {
                 setBalanceForThisInstallment(null);
              }
            }
            setReceipt(collectionData);

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
      fetchReceiptAndRelatedData();
    }
  }, [recordId]);

  const handlePrint = () => {
    if (!receipt) return;

    const companyNameHtml = `<div class="company-name center">${receipt.companyName || "Sendhur Chits"}</div>`;
    const receiptNumberHtml = `<div class="receipt-info center">Receipt No: ${receipt.receiptNumber || 'N/A'}</div>`;
    const dateTimeHtml = `<div class="receipt-info center">Date: ${formatDate(receipt.paymentDate, "dd-MMM-yyyy")} ${receipt.paymentTime || ''}</div>`;
    
    const groupNameHtml = `<div class="section-item"><span class="field-label">Group:</span> <span class="field-value">${receipt.groupName || 'N/A'}</span></div>`;
    const userNameHtml = `<div class="section-item"><span class="field-label">Name:</span> <span class="field-value">${receipt.userFullname || 'N/A'}</span></div>`;
    
    const chitSchemeValueHtml = `<div class="section-item"><span class="field-label">Chit Scheme Value:</span> <span class="field-value">${receipt.groupTotalAmount ? formatCurrency(receipt.groupTotalAmount) : 'N/A'}</span></div>`;
    const chitDateHtml = `<div class="section-item"><span class="field-label">Chit Date:</span> <span class="field-value">${receipt.auctionDateForReceipt ? formatDate(receipt.auctionDateForReceipt, "dd-MMM-yyyy") : formatDate(receipt.paymentDate, "dd-MMM-yyyy")}</span></div>`;
    
    const dueNumberHtml = receipt.dueNumber ? `<div class="section-item"><span class="field-label">Due No.:</span> <span class="field-value">${receipt.dueNumber}</span></div>` : '';
    
    const dueAmountForInstallmentHtml = (amountDueForThisInstallment !== null && amountDueForThisInstallment !== undefined) ? `<div class="section-item"><span class="field-label">Due Amount (This Inst.):</span> <span class="field-value">${formatCurrency(amountDueForThisInstallment)}</span></div>` : '';
    const totalPaidForInstallmentHtml = (totalPaidForThisDue !== null && totalPaidForThisDue !== undefined) ? `<div class="section-item"><span class="field-label">Paid Amount (This Inst.):</span> <span class="field-value">${formatCurrency(totalPaidForThisDue)}</span></div>` : '';
    const billAmountHtml = `<div class="section-item"><span class="field-label">Bill Amount (This Txn.):</span> <span class="field-value">${formatCurrency(receipt.amount)}</span></div>`;
    const balanceForInstallmentHtml = (balanceForThisInstallment !== null && balanceForThisInstallment !== undefined) ? `<div class="section-item"><span class="field-label">Balance (This Inst.):</span> <span class="field-value">${formatCurrency(balanceForThisInstallment)}</span></div>` : '';
    const overallBalanceHtml = (receipt.userTotalDueBeforeThisPayment !== null && receipt.userTotalDueBeforeThisPayment !== undefined) ? `<div class="section-item"><span class="field-label">User Total Balance (Overall):</span> <span class="field-value">${formatCurrency(receipt.userTotalDueBeforeThisPayment)}</span></div>` : '';
    
    const paymentModeHtml = `<div class="section-item"><span class="field-label">Mode:</span> <span class="field-value">${receipt.paymentMode || 'N/A'}</span></div>`;
    const thankYouHtml = `<div class="thank-you center">Thank You!</div>`;

    const receiptHTML = \`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>
          @media print {
            @page {
              margin: 0;
              size: 72mm auto; 
            }
            body, html {
                width: 72mm !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
            }
            body > *:not(#printable-receipt-area) {
                display: none !important;
                visibility: hidden !important;
            }
            #printable-receipt-area, #printable-receipt-area * {
                visibility: visible !important;
                display: block !important;
            }
            #printable-receipt-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 72mm !important;
                height: auto !important; 
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                overflow: visible !important;
            }
            #printable-receipt-area .receipt-print-content {
                width: 100% !important;
                margin: 0 !important;
                padding: 1mm !important; 
                box-shadow: none !important;
                background: white !important;
                font-family: 'Times New Roman', Times, serif !important;
                font-size: 11pt !important; 
                line-height: 1.2 !important;
                color: black !important;
                box-sizing: border-box !important;
            }
            .receipt-print-content .center { text-align: center !important; margin-bottom: 0.5mm !important; }
            .receipt-print-content .company-name { font-weight: bold !important; }
            .receipt-print-content .receipt-info { font-weight: normal !important; }
            .receipt-print-content .thank-you { font-weight: normal !important; margin-top: 0.5mm !important; }
            .receipt-print-content hr {
              border: none !important;
              border-top: 1px dashed black !important;
              margin: 1mm 0 !important;
            }
            .receipt-print-content .section-item {
              display: flex !important; 
              justify-content: flex-start !important;
              align-items: baseline !important; 
              margin-bottom: 0.5mm !important;
              white-space: nowrap;
              overflow: hidden;    
              text-overflow: ellipsis; 
            }
            .receipt-print-content .field-label { display: inline !important; font-weight: bold !important; padding-right: 0.5em !important; }
            .receipt-print-content .field-value { display: inline !important; font-weight: normal !important;}
            .receipt-print-content h1, .receipt-print-content h2, .receipt-print-content h3, .receipt-print-content h4, .receipt-print-content h5, .receipt-print-content h6, .receipt-print-content p, .receipt-print-content div {
                margin: 0.5mm 0 !important;
                font-size: 11pt !important; 
            }
            iframe[id^="webpack-dev-server-client-overlay"],
            iframe[id^="vite-error-overlay"],
            div[id^="vite-plugin-checker-error-overlay"],
            div[class*="firebase-emulator-warning"] {
              display: none !important;
              visibility: hidden !important;
            }
          }
        </style>
      </head>
      <body>
        <div id="printable-receipt-area">
          <div class="receipt-print-content">
            \${companyNameHtml}
            \${receiptNumberHtml}
            \${dateTimeHtml}
            <hr>
            \${groupNameHtml}
            \${userNameHtml}
            \${chitSchemeValueHtml}
            \${chitDateHtml}
            \${dueNumberHtml}
            \${dueAmountForInstallmentHtml}
            \${totalPaidForInstallmentHtml}
            \${billAmountHtml}
            \${balanceForInstallmentHtml}
            \${overallBalanceHtml}
            \${paymentModeHtml}
            <hr>
            \${thankYouHtml}
          </div>
        </div>
      </body>
      </html>
    \`;

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
      
      const attemptPrint = () => {
        if (printFrame.contentWindow?.document.readyState === 'complete') {
          printFrame.contentWindow?.focus(); 
          printFrame.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 1000); 
        } else {
          setTimeout(attemptPrint, 100);
        }
      };
      attemptPrint();
    } else {
      console.error("Could not get iframe document context for printing.");
      if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
      }
    }
  };

  const handleDone = () => {
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
    <div id="receipt-content-wrapper" className="flex flex-col items-center justify-start min-h-screen bg-background p-4">
      <div id="receipt-content" className="w-full max-w-md bg-card p-6 shadow-lg print:p-0">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">{receipt.companyName || "Sendhur Chits"}</h1>
            <p className="text-sm">Payment Receipt</p>
          </div>
          <div className="text-xs space-y-1 border-t border-b border-dashed border-gray-400 py-2 my-2">
            <p><strong>Receipt No:</strong> {receipt.receiptNumber}</p>
            <p><strong>Date:</strong> {formatDate(receipt.paymentDate)} {receipt.paymentTime}</p>
          </div>
          <div className="text-xs space-y-1 mb-2">
            <p><strong>Group:</strong> {receipt.groupName}</p>
            <p><strong>Name:</strong> {receipt.userFullname}</p>
            <p><strong>Chit Scheme Value:</strong> {receipt.groupTotalAmount ? formatCurrency(receipt.groupTotalAmount) : 'N/A'}</p>
            <p><strong>Chit Date:</strong> {receipt.auctionDateForReceipt ? formatDate(receipt.auctionDateForReceipt) : formatDate(receipt.paymentDate)}</p>
            {receipt.dueNumber ? <p><strong>Due No:</strong> {receipt.dueNumber}</p> : null}
            
            {(amountDueForThisInstallment !== null && amountDueForThisInstallment !== undefined) ? <p><strong>Due Amount (This Inst.):</strong> {formatCurrency(amountDueForThisInstallment)}</p> : null}
            {(totalPaidForThisDue !== null && totalPaidForThisDue !== undefined) ? <p><strong>Paid Amount (This Inst.):</strong> {formatCurrency(totalPaidForThisDue)}</p> : null}
            <p className="font-bold text-sm"><strong>Bill Amount (This Txn.):</strong> {formatCurrency(receipt.amount)}</p>
            {(balanceForThisInstallment !== null && balanceForThisInstallment !== undefined) ? <p><strong>Balance (This Inst.):</strong> {formatCurrency(balanceForThisInstallment)}</p> : null}
            {(receipt.userTotalDueBeforeThisPayment !== null && receipt.userTotalDueBeforeThisPayment !== undefined) ? <p><strong>User Total Balance (Overall):</strong> {formatCurrency(receipt.userTotalDueBeforeThisPayment)}</p> : null}
            <p><strong>Payment Mode:</strong> {receipt.paymentMode}</p>
          </div> 
          <div className="text-xs space-y-1 border-t border-dashed border-gray-400 pt-2 mt-2">
            {receipt.virtualTransactionId && <p><strong>Virtual ID:</strong> {receipt.virtualTransactionId}</p>}
            <p className="text-center mt-4">Thank You!</p>
          </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 print:hidden">
        <Button onClick={handleDone} variant="outline" className="w-full sm:w-auto">
            <Eye className="mr-2 h-4 w-4"/> View User Dues
        </Button>
        <Button onClick={handlePrint} variant="default" className="w-full sm:w-auto">
          <Printer className="mr-2 h-4 w-4" /> Print Receipt
        </Button>
      </div>
    </div>
  );
}

    
    