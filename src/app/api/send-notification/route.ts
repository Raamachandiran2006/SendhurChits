
import { type NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const twilioWhatsAppFromNumber = process.env.TWILIO_WHATSAPP_FROM_NUMBER;
    const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+91';

    if (!accountSid || !authToken || !twilioPhoneNumber || !twilioWhatsAppFromNumber) {
      console.error('[API/send-notification] Critical Error: Twilio environment variables are not configured correctly. Please check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_WHATSAPP_FROM_NUMBER.');
      return NextResponse.json({ success: false, error: 'Twilio configuration missing on server. Please contact administrator.' }, { status: 500 });
    }

    const body = await request.json();
    const { toPhoneNumber, userName, amount, receiptNumber, collectionLocation, paymentDate, paymentTime } = body;

    if (!toPhoneNumber || !userName || amount === undefined || !receiptNumber) {
      console.error('[API/send-notification] Missing required fields in request body:', body);
      return NextResponse.json({ success: false, error: 'Missing required fields in request body' }, { status: 400 });
    }

    const client = twilio(accountSid, authToken);
    
    const formattedToPhoneNumber = defaultCountryCode + toPhoneNumber.replace(/^\+?91/, ''); 

    const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    const collectionDateTime = `${paymentDate} ${paymentTime || ''}`;
    
    let messageBody = `Dear ${userName},\n\nCollection Recorded:\nAmount: ${formattedAmount}\nReceipt No: ${receiptNumber}\nDate: ${collectionDateTime}\n`;
    if (collectionLocation && collectionLocation !== "Office" && !collectionLocation.startsWith("http")) {
      messageBody += `Location: ${collectionLocation}\n`;
    } else if (collectionLocation && collectionLocation.startsWith("http")) {
      messageBody += `Location: View on Map\n`;
    }
    messageBody += `\nThank you,\nSendhur Chits`;

    console.log(`[API/send-notification] Attempting to send to ${formattedToPhoneNumber}. Message: ${messageBody}`);

    let smsSent = false;
    let whatsappSent = false;
    let smsError = null;
    let whatsappError = null;

    // Send SMS
    try {
      const smsResponse = await client.messages.create({
        body: messageBody,
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
        body: messageBody,
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
