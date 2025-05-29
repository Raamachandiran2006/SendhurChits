# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Variables for Production

When you build your application for production (e.g., using `npm run build` and then `npm run start`, or when deploying to a hosting provider), Next.js handles environment variables differently than in development (`npm run dev`).

- `.env.local` is used for `npm run dev` but **not** for production builds.
- For production, environment variables must be set directly in your hosting environment's settings.
- If you are testing a production build locally (e.g., after `npm run build` with `npm run start`), you can create a `.env.production` file in the root of your project. This file should contain your production environment variables, similar to `.env.local`.

**Example `.env.production` for Twilio:**
```
TWILIO_ACCOUNT_SID=your_production_account_sid
TWILIO_AUTH_TOKEN=your_production_auth_token
TWILIO_PHONE_NUMBER=your_production_twilio_phone_number
TWILIO_WHATSAPP_FROM_NUMBER=your_production_twilio_whatsapp_number
DEFAULT_COUNTRY_CODE=+91
```
**Important:** Ensure that `.env.production` (if it contains secrets) is added to your `.gitignore` file to prevent it from being committed to version control.

If environment variables (like Twilio API keys) are missing in the production environment, API routes or server-side functionality relying on them will fail, potentially causing "Internal Server Error" messages.
