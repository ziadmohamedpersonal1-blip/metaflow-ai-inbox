# MetaFlow AI Inbox

MetaFlow AI Inbox is a unified AI-powered inbox system for businesses that receive leads from WhatsApp, Facebook Messenger, Instagram DM, Email, and manual sources.

The system receives inbound messages, saves conversations in Supabase, detects customer intent, scores each lead, generates replies, and highlights conversations that need human review.

## Business Value

MetaFlow helps businesses stop losing leads from scattered inboxes.

It helps teams:

- Reply faster to inbound leads
- Centralize WhatsApp, Instagram, Facebook, Messenger, and Email conversations
- Identify high-intent leads
- Detect customer intent automatically
- Flag urgent conversations for human review
- Export leads for sales follow-up
- Reduce manual inbox work

## Features

- WhatsApp inbound webhook support
- Facebook Messenger inbound webhook support
- Instagram DM inbound webhook support
- Email webhook support
- Manual dashboard simulation
- OpenAI AI replies
- Professional fallback demo replies when OpenAI quota is unavailable
- Lead scoring
- Intent detection
- Needs human review detection
- Protected admin dashboard
- Conversation dashboard
- Conversation message history
- Human reply workflow
- Clear demo data button
- Activity logs
- CSV export
- Supabase database
- Vercel-ready deployment
- Mobile-first SaaS-style UI

## Tech Stack

- Node.js
- Express.js
- Supabase
- OpenAI API
- Meta Webhooks
- WhatsApp Cloud API
- Facebook Messenger API
- Instagram Messaging API
- Nodemailer
- Vercel
- HTML, CSS, JavaScript

## Project Structure

```txt
metaflow-ai-inbox/
│
├── server.js
├── package.json
├── package-lock.json
├── vercel.json
├── README.md
├── CLIENT_ONBOARDING.md
├── .env.example
├── .gitignore
│
├── public/
│   └── index.html
│
└── node_modules/
```

## Environment Variables

Create a `.env` file in the root folder.

```env
PORT=3000

SUPABASE_URL=https://ksxpxnuupwvdwsofuuai.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PUT_SUPABASE_SECRET_SERVICE_ROLE_KEY_HERE

OPENAI_API_KEY=PUT_OPENAI_API_KEY_HERE
OPENAI_MODEL=gpt-4.1-mini

ADMIN_TOKEN=PUT_ADMIN_TOKEN_HERE

META_VERIFY_TOKEN=metaflow_verify_123
META_GRAPH_VERSION=v23.0

AUTO_SEND=false

META_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=

INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ID=

EMAIL_FROM_NAME=MetaFlow AI Inbox
EMAIL_FROM_ADDRESS=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
```

Important:

- Do not commit `.env` to GitHub.
- Use the Supabase `service_role` secret key, not the anon public key.
- Keep `AUTO_SEND=false` during testing.
- Set `AUTO_SEND=true` only after live credentials are fully tested.
- Use `ADMIN_TOKEN` to protect the live dashboard.

## Admin Protection

Protected dashboard routes require an admin token.

Set this in `.env`:

```env
ADMIN_TOKEN=your_secure_admin_token
```

When the dashboard opens, it asks for the admin token.  
The token is stored locally in the browser and sent with protected requests.

Protected actions include:

- Viewing conversations
- Simulating messages
- Viewing messages
- Sending human replies
- Changing statuses
- Exporting CSV
- Clearing demo data
- Viewing logs

Meta webhooks stay public because Meta needs to call them directly.

## Supabase Tables

The system uses three main tables:

- `inbox_conversations`
- `inbox_messages`
- `inbox_logs`

These tables store customer conversations, message history, and system activity logs.

## Local Development

Install dependencies:

```bash
npm install
```

Run the project locally:

```bash
npm run dev
```

If PowerShell blocks npm scripts, use:

```bash
npm.cmd run dev
```

Open the dashboard:

```txt
http://localhost:3000/dashboard
```

## Main Routes

### Dashboard

```txt
GET /dashboard
```

### Health Check

```txt
GET /health
```

### Meta Webhook Verification

```txt
GET /webhooks/meta
```

### Meta Webhook Receiver

```txt
POST /webhooks/meta
```

### Email Webhook Receiver

```txt
POST /webhooks/email
```

### Simulate Incoming Message

```txt
POST /simulate/inbound
```

### Get Conversations

```txt
GET /conversations
```

### Get Conversation Messages

```txt
GET /conversations/:id/messages
```

### Update Conversation Status

```txt
PUT /conversations/:id/status
```

### Human Reply

```txt
POST /conversations/:id/human-reply
```

### Add Demo Data

```txt
POST /demo/seed
```

### Clear Demo Data

```txt
DELETE /demo/clear
```

### Activity Logs

```txt
GET /logs
```

### Export CSV

```txt
GET /export/csv
```

## Demo Workflow

1. Open the dashboard.
2. Enter the admin token.
3. Choose a channel: WhatsApp, Facebook, Instagram, Email, or Manual.
4. Enter customer details.
5. Write an inbound message.
6. Click "Generate Reply".
7. The system will:
   - Save the conversation
   - Save the inbound message
   - Detect intent
   - Calculate lead score
   - Decide if human review is needed
   - Generate an OpenAI or fallback demo reply
   - Save the outbound reply
   - Add an activity log

## Safe Demo Mode

By default:

```env
AUTO_SEND=false
```

This means the system generates and saves replies, but it does not send real messages to WhatsApp, Facebook, Instagram, or Email.

This is recommended for demos, testing, and client walkthroughs.

## OpenAI Fallback Mode

If OpenAI is unavailable, quota is exceeded, or the API key is missing, MetaFlow uses a professional fallback demo reply.

The message is labeled as:

```txt
fallback-demo
```

This keeps the demo working even before OpenAI billing is active.

## Live Sending

To enable live sending, add the required Meta and SMTP credentials, then change:

```env
AUTO_SEND=true
```

Use this only after testing webhook receiving and outbound replies carefully.

## Deployment

This project is ready for Vercel.

The `vercel.json` file routes all requests to `server.js`.

After deployment, the live webhook URL will look like:

```txt
https://your-project-name.vercel.app/webhooks/meta
```

Use this URL as the Meta Webhook Callback URL.

## Required Vercel Environment Variables

Add these in Vercel Project Settings:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ADMIN_TOKEN=
META_VERIFY_TOKEN=metaflow_verify_123
META_GRAPH_VERSION=v23.0
AUTO_SEND=false
```

For live WhatsApp sending:

```env
META_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

For live Facebook Messenger sending:

```env
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
```

For live Instagram sending:

```env
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ID=
```

For live email sending:

```env
EMAIL_FROM_NAME=
EMAIL_FROM_ADDRESS=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
```

## Client Use Cases

MetaFlow is useful for:

- Clinics
- Medspas
- Real estate agencies
- Home service companies
- Gyms and fitness coaches
- Local service businesses
- Agencies
- E-commerce brands
- Training centers

## Monetization Model

MetaFlow can be sold as a done-for-you AI automation service.

Example pricing:

```txt
Starter:
$300 setup + $99/month

Growth:
$700 setup + $199/month

High Volume:
$1500 setup + $399/month
```

Early case study pricing:

```txt
$150-$300 setup + $50-$100/month
```

## Author

Built by Ziad Mohamed.