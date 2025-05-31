
import { type NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface DueUserDetail {
  username: string;
  fullname: string; // Added fullname
  phone: string;
  dueAmount: number;
}

export async function POST(request: NextRequest) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // This will be the 'from' number for SMS
    const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+91';

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error('[API/send-due-summary-sms] Critical Error: Twilio environment variables are not configured correctly.');
      return NextResponse.json({ success: false, error: 'Twilio configuration missing on server.' }, { status: 500 });
    }

    const body = await request.json();
    const {
      employeePhoneNumber,
      dueUserDetails,
    }: { employeePhoneNumber: string; dueUserDetails: DueUserDetail[] } = body;

    if (!employeePhoneNumber || !dueUserDetails || !Array.isArray(dueUserDetails) || dueUserDetails.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields: employeePhoneNumber and dueUserDetails array.' }, { status: 400 });
    }

    const client = twilio(accountSid, authToken);
    
    const formattedEmployeePhoneNumber = defaultCountryCode + String(employeePhoneNumber).replace(/^\+?91/, '');

    let messageBody = "Customer Due Summary:\n";
    dueUserDetails.forEach((user, index) => {
      messageBody += `\n${index + 1}. User: ${user.fullname} (${user.username})\n`; // Updated to include fullname
      messageBody += `   Phone: ${user.phone}\n`;
      messageBody += `   Due: ${formatCurrency(user.dueAmount)}\n`;
    });
    messageBody += "\n- Sendhur Chits";

    console.log(`[API/send-due-summary-sms] Attempting to send SMS to ${formattedEmployeePhoneNumber}. Message: ${messageBody}`);

    try {
      const smsResponse = await client.messages.create({
        body: messageBody,
        from: twilioPhoneNumber,
        to: formattedEmployeePhoneNumber,
      });
      console.log(`[API/send-due-summary-sms] SMS sent successfully to ${formattedEmployeePhoneNumber}. SID: ${smsResponse.sid}`);
      return NextResponse.json({ success: true, message: 'Due summary SMS sent successfully.' }, { status: 200 });
    } catch (error: any) {
      console.error(`[API/send-due-summary-sms] Error sending SMS to ${formattedEmployeePhoneNumber}:`, error);
      return NextResponse.json({ success: false, error: 'Failed to send SMS.', details: error.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API/send-due-summary-sms] General error in API route:', error);
    // If the error is from request.json() failing (e.g., malformed JSON from client)
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({ success: false, error: 'Invalid JSON payload in request.', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error.', details: error.message }, { status: 500 });
  }
}
