
import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Privacy Policy - Sendhur Chits',
  description: 'Privacy Policy for Sendhur Chits services.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 md:px-6">
      <Card className="shadow-lg">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-3xl font-bold text-primary">Privacy Policy</CardTitle>
          <CardDescription>Last updated: May 30, 2025</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6 text-foreground/90">
          <p>
            This Privacy Notice for Sendhur Chits ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>Visit our website at http://www.sendhurchits.in, or any website of ours that links to this Privacy Notice</li>
            <li>Download and use our mobile application (Sendhur Chits), or any other application of ours that links to this Privacy Notice</li>
            <li>Engage with us in other related ways, including any sales, marketing, or events</li>
          </ul>
          <p>
            <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="mailto:director.sendhurfinance@gmail.com" className="text-primary hover:underline">director.sendhurfinance@gmail.com</a>.
          </p>

          <h2 className="text-2xl font-semibold text-primary pt-4 border-t mt-6">SUMMARY OF KEY POINTS</h2>
          <p>
            This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.
          </p>
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about <a href="#what-info" className="text-primary hover:underline">personal information you disclose to us</a>.</li>
            <li><strong>Do we process any sensitive personal information?</strong> Some of the information may be considered "special" or "sensitive" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.</li>
            <li><strong>Do we collect any information from third parties?</strong> We do not collect any information from third parties.</li>
            <li><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about <a href="#how-process" className="text-primary hover:underline">how we process your information</a>.</li>
            <li><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties. Learn more about <a href="#when-share" className="text-primary hover:underline">when and with whom we share your personal information</a>.</li>
            <li><strong>How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about <a href="#how-safe" className="text-primary hover:underline">how we keep your information safe</a>.</li>
            <li><strong>What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about <a href="#your-rights" className="text-primary hover:underline">your privacy rights</a>.</li>
            <li><strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by submitting a data subject access request, or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws.</li>
          </ul>
          <p>Want to learn more about what we do with any information we collect? Review the Privacy Notice in full.</p>

          <h2 className="text-2xl font-semibold text-primary pt-4 border-t mt-6">TABLE OF CONTENTS</h2>
          <ol className="list-decimal list-inside space-y-1 pl-4">
            <li><a href="#what-info" className="text-primary hover:underline">WHAT INFORMATION DO WE COLLECT?</a></li>
            <li><a href="#how-process" className="text-primary hover:underline">HOW DO WE PROCESS YOUR INFORMATION?</a></li>
            <li><a href="#when-share" className="text-primary hover:underline">WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</a></li>
            <li><a href="#how-long" className="text-primary hover:underline">HOW LONG DO WE KEEP YOUR INFORMATION?</a></li>
            <li><a href="#how-safe" className="text-primary hover:underline">HOW DO WE KEEP YOUR INFORMATION SAFE?</a></li>
            <li><a href="#minors-info" className="text-primary hover:underline">DO WE COLLECT INFORMATION FROM MINORS?</a></li>
            <li><a href="#your-rights" className="text-primary hover:underline">WHAT ARE YOUR PRIVACY RIGHTS?</a></li>
            <li><a href="#dnt-features" className="text-primary hover:underline">CONTROLS FOR DO-NOT-TRACK FEATURES</a></li>
            <li><a href="#updates-notice" className="text-primary hover:underline">DO WE MAKE UPDATES TO THIS NOTICE?</a></li>
            <li><a href="#contact-us" className="text-primary hover:underline">HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</a></li>
            <li><a href="#review-update-delete" className="text-primary hover:underline">HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</a></li>
          </ol>

          <section id="what-info" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">1. WHAT INFORMATION DO WE COLLECT?</h3>
            <h4 className="text-lg font-medium">Personal information you disclose to us</h4>
            <p><strong>In Short:</strong> We collect personal information that you provide to us.</p>
            <p>
              We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.
            </p>
            <p>
              <strong>Personal Information Provided by You.</strong> The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-6">
              <li>names</li>
              <li>phone numbers</li>
              <li>usernames</li>
              <li>passwords</li>
              <li>date of birth</li>
              <li>address</li>
              <li>aadhaar card</li>
              <li>pan card</li>
              <li>photograph</li>
            </ul>
            <p><strong>Sensitive Information.</strong> We do not process sensitive information.</p>
            <p><strong>Application Data.</strong> If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:</p>
            <ul className="list-disc list-inside space-y-1 pl-6">
              <li><strong>Push Notifications.</strong> We may request to send you push notifications regarding your account or certain features of the application(s). If you wish to opt out from receiving these types of communications, you may turn them off in your device's settings.</li>
            </ul>
            <p>This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes.</p>
            <p>All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.</p>
          </section>

          <section id="how-process" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">2. HOW DO WE PROCESS YOUR INFORMATION?</h3>
            <p><strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.</p>
            <p>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
            <ul className="list-disc list-inside space-y-1 pl-6">
              <li><strong>To facilitate account creation and authentication and otherwise manage user accounts.</strong> We may process your information so you can create and log in to your account, as well as keep your account in working order.</li>
              <li><strong>To administer prize draws and competitions.</strong> We may process your information to administer prize draws and competitions.</li>
            </ul>
          </section>

          <section id="when-share" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h3>
            <p><strong>In Short:</strong> We may share information in specific situations described in this section and/or with the following third parties.</p>
            <p>We may need to share your personal information in the following situations:</p>
            <ul className="list-disc list-inside space-y-1 pl-6">
              <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
            </ul>
          </section>

          <section id="how-long" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">4. HOW LONG DO WE KEEP YOUR INFORMATION?</h3>
            <p><strong>In Short:</strong> We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</p>
            <p>
              We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.
            </p>
            <p>
              When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.
            </p>
          </section>

          <section id="how-safe" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">5. HOW DO WE KEEP YOUR INFORMATION SAFE?</h3>
            <p><strong>In Short:</strong> We aim to protect your personal information through a system of organizational and technical security measures.</p>
            <p>
              We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.
            </p>
          </section>

          <section id="minors-info" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">6. DO WE COLLECT INFORMATION FROM MINORS?</h3>
            <p><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18 years of age.</p>
            <p>
              We do not knowingly collect, solicit data from, or market to children under 18 years of age, nor do we knowingly sell such personal information. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent’s use of the Services. If we learn that personal information from users less than 18 years of age has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any data we may have collected from children under age 18, please contact us at <a href="mailto:director.sendhurfinance@gmail.com" className="text-primary hover:underline">director.sendhurfinance@gmail.com</a>.
            </p>
          </section>

          <section id="your-rights" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">7. WHAT ARE YOUR PRIVACY RIGHTS?</h3>
            <p><strong>In Short:</strong> You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</p>
            <p>
              <strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section <a href="#contact-us" className="text-primary hover:underline">"HOW CAN YOU CONTACT US ABOUT THIS NOTICE?"</a> below.
            </p>
            <p>
              However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.
            </p>
            <h4 className="text-lg font-medium">Account Information</h4>
            <p>If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
            <ul className="list-disc list-inside space-y-1 pl-6">
              <li>Contact us using the contact information provided.</li>
            </ul>
            <p>
              Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.
            </p>
            <p>
              If you have questions or comments about your privacy rights, you may email us at <a href="mailto:director.sendhurfinance@gmail.com" className="text-primary hover:underline">director.sendhurfinance@gmail.com</a>.
            </p>
          </section>

          <section id="dnt-features" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">8. CONTROLS FOR DO-NOT-TRACK FEATURES</h3>
            <p>
              Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.
            </p>
          </section>

          <section id="updates-notice" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">9. DO WE MAKE UPDATES TO THIS NOTICE?</h3>
            <p><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</p>
            <p>
              We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Revised" date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.
            </p>
          </section>

          <section id="contact-us" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">10. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h3>
            <p>If you have questions or comments about this notice, you may email us at <a href="mailto:director.sendhurfinance@gmail.com" className="text-primary hover:underline">director.sendhurfinance@gmail.com</a> or contact us by post at:</p>
            <address className="not-italic space-y-0.5">
              Sendhur Chits<br />
              MS corner, moongil padi road, Chinnasalem<br />
              Kallakurichi, Tamil Nadu 606201<br />
              India
            </address>
          </section>

          <section id="review-update-delete" className="space-y-3 pt-4 border-t mt-6">
            <h3 className="text-xl font-semibold text-primary">11. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h3>
            <p>
              Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please fill out and submit a data subject access request.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

    