
import { type NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { format as formatDateFns, parseISO } from 'date-fns';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateForMessage = (dateString: string | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateString) return "N/A";
  try {
    // Handle both 'YYYY-MM-DD' and ISO strings
    const date = dateString.includes('T') ? parseISO(dateString) : new Date(dateString.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return "N/A";
    return formatDateFns(date, outputFormat);
  } catch (e) {
    return "N/A";
  }
};


export async function POST(request: NextRequest) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const twilioWhatsAppFromNumber = process.env.TWILIO_WHATSAPP_FROM_NUMBER;
    const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+91';

    if (!accountSid || !authToken || !twilioPhoneNumber || !twilioWhatsAppFromNumber) {
      console.error('[API/send-notification] Critical Error: Twilio environment variables are not configured correctly.');
      return NextResponse.json({ success: false, error: 'Twilio configuration missing on server.' }, { status: 500 });
    }

    const body = await request.json();
    const { toPhoneNumber, customMessageBody } = body;

    if (!toPhoneNumber) {
        return NextResponse.json({ success: false, error: 'toPhoneNumber is a required field.' }, { status: 400 });
    }

    let finalMessageBody = "";

    if (customMessageBody) {
      // Use the provided custom message body directly
      finalMessageBody = customMessageBody;
    } else {
      // If no custom body, assume it's a receipt and validate/construct the message
      const { 
        userName, receiptNumber, paymentDate, paymentTime, groupName, 
        groupTotalAmount, auctionDateForReceipt, dueNumber, chitAmount, 
        totalPaidForThisDue, amount, balanceForThisInstallment, paymentMode 
      } = body;
      
      const requiredFields = { userName, receiptNumber, paymentDate, paymentTime, groupName, groupTotalAmount, amount, paymentMode };
      const missingFields = Object.entries(requiredFields)
        .filter(([, value]) => value === undefined || value === null)
        .map(([key]) => key);

      if (missingFields.length > 0) {
        console.error('[API/send-notification] Missing required fields for receipt notification:', missingFields.join(', '));
        return NextResponse.json({ success: false, error: `Missing required receipt fields: ${missingFields.join(', ')}` }, { status: 400 });
      }

      finalMessageBody = `Receipt No: ${receiptNumber}\n` +
                        `Date: ${formatDateForMessage(paymentDate)} ${paymentTime || ''}\n\n` +
                        `Group : ${groupName || 'N/A'}\n` +
                        `Name : ${userName || 'N/A'}\n` +
                        `Chit Value : ${formatCurrency(groupTotalAmount)}\n` +
                        `Chit Date : ${formatDateForMessage(auctionDateForReceipt)}\n` +
                        (dueNumber ? `Due No : ${dueNumber}\n` : '') +
                        `Due Amount : ${formatCurrency(chitAmount)}\n` +
                        `Paid Amount : ${formatCurrency(totalPaidForThisDue)}\n` +
                        `Bill Amount : ${formatCurrency(amount)}\n` +
                        `Balance : ${formatCurrency(balanceForThisInstallment)}\n` +
                        `Payment Mode : ${paymentMode || 'N/A'}\n\n` +
                        `Thank you,\nSendhur Chits`;
    }

    const client = twilio(accountSid, authToken);
    const formattedToPhoneNumber = defaultCountryCode + String(toPhoneNumber).replace(/^\+?91/, '');

    console.log(`[API/send-notification] Attempting to send to ${formattedToPhoneNumber}. Message: ${finalMessageBody}`);

    let smsSent = false;
    let whatsappSent = false;
    let smsError = null;
    let whatsappError = null;

    // Send SMS
    try {
      const smsResponse = await client.messages.create({
        body: finalMessageBody,
        from: twilioPhoneNumber,
        to: formattedToPhoneNumber,
      });
      smsSent = true;
      console.log(`[API/send-notification] SMS sent successfully to ${formattedToPhoneNumber}. SID: ${smsResponse.sid}`);
    } catch (error: any) {
      smsError = error.message;
      console.error(`[API/send-notification] Error sending SMS to ${formattedToPhoneNumber}:`, error);
    }

    // Send WhatsApp message
    try {
      const whatsappResponse = await client.messages.create({
        body: finalMessageBody,
        from: twilioWhatsAppFromNumber,
        to: `whatsapp:${formattedToPhoneNumber}`,
      });
      whatsappSent = true;
      console.log(`[API/send-notification] WhatsApp message sent successfully to whatsapp:${formattedToPhoneNumber}. SID: ${whatsappResponse.sid}`);
    } catch (error: any) {
      whatsappError = error.message;
      console.error(`[API/send-notification] Error sending WhatsApp message to whatsapp:${formattedToPhoneNumber}:`, error);
    }

    if (smsSent || whatsappSent) {
      return NextResponse.json({ 
        success: true, 
        message: 'Notifications initiated.',
        smsStatus: smsSent ? 'Sent' : `Failed: ${smsError}`,
        whatsappStatus: whatsappSent ? 'Sent' : `Failed: ${whatsappError}`
      }, { status: 200 });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send any notification.',
        smsError,
        whatsappError 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API/send-notification] General error in send-notification API route:', error);
    return NextResponse.json({ success: false, error: 'Internal server error on notification API.', details: error.message }, { status: 500 });
  }
}
