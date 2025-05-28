
import { type NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toPhoneNumber, userName, amount, receiptNumber, collectionLocation, paymentDate, paymentTime } = body;

    if (!toPhoneNumber || !userName || amount === undefined || !receiptNumber) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const twilioWhatsAppFromNumber = process.env.TWILIO_WHATSAPP_FROM_NUMBER;
    const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+91'; // Default to India if not set

    if (!accountSid || !authToken || !twilioPhoneNumber || !twilioWhatsAppFromNumber) {
      console.error('Twilio credentials or numbers are not configured in environment variables.');
      return NextResponse.json({ success: false, error: 'Twilio configuration missing on server' }, { status: 500 });
    }

    const client = twilio(accountSid, authToken);
    const formattedToPhoneNumber = defaultCountryCode + toPhoneNumber; // Assuming toPhoneNumber is 10 digits

    const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    const collectionDateTime = `${paymentDate} ${paymentTime}`;
    
    let messageBody = `Dear ${userName},\n\nCollection Recorded:\nAmount: ${formattedAmount}\nReceipt No: ${receiptNumber}\nDate: ${collectionDateTime}\n`;
    if (collectionLocation && collectionLocation !== "Office") {
      messageBody += `Location: ${collectionLocation}\n`;
    }
    messageBody += `\nThank you,\nSendhur Chits`;

    let smsSent = false;
    let whatsappSent = false;
    let smsError = null;
    let whatsappError = null;

    // Send SMS
    try {
      await client.messages.create({
        body: messageBody,
        from: twilioPhoneNumber,
        to: formattedToPhoneNumber,
      });
      smsSent = true;
      console.log(`SMS sent successfully to ${formattedToPhoneNumber}`);
    } catch (error: any) {
      smsError = error.message;
      console.error(`Error sending SMS to ${formattedToPhoneNumber}:`, error.message);
    }

    // Send WhatsApp message
    try {
      await client.messages.create({
        body: messageBody,
        from: twilioWhatsAppFromNumber, // e.g., 'whatsapp:+14155238886'
        to: `whatsapp:${formattedToPhoneNumber}`,
      });
      whatsappSent = true;
      console.log(`WhatsApp message sent successfully to whatsapp:${formattedToPhoneNumber}`);
    } catch (error: any) {
      whatsappError = error.message;
      console.error(`Error sending WhatsApp message to whatsapp:${formattedToPhoneNumber}:`, error.message);
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
    console.error('Error in send-notification API route:', error);
    return NextResponse.json({ success: false, error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
