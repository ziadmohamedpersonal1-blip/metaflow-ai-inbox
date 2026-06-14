# MetaFlow AI Inbox

MetaFlow AI Inbox is a unified AI-powered inbox system for businesses that receive leads from WhatsApp, Facebook Messenger, Instagram DM, Email, and manual sources.

The system receives inbound messages, saves conversations in Supabase, detects customer intent, scores each lead, generates AI replies, and highlights conversations that need human review.

## Features

* WhatsApp inbound webhook support
* Facebook Messenger inbound webhook support
* Instagram DM inbound webhook support
* Email webhook support
* Manual dashboard simulation
* AI auto-reply using OpenAI API
* Professional fallback replies when OpenAI quota is unavailable
* Lead scoring
* Intent detection
* Needs human review detection
* Conversation dashboard
* Conversation message history
* Human reply workflow
* Activity logs
* CSV export
* Supabase database
* Vercel-ready deployment
* Mobile-first SaaS-style UI

## Tech Stack

* Node.js
* Express.js
* Supabase
* OpenAI API
* Meta Webhooks
* WhatsApp Cloud API
* Facebook Messenger API
* Instagram Messaging API
* Nodemailer
* Vercel
* HTML, CSS, JavaScript

## Project Structure

```txt
metaflow-ai-inbox/
│
├── server.js
├── package.json
├── package-lock.json
├── vercel.json
├── README.md
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

* Do not commit `.env` to GitHub.
* Use the Supabase `service_role` secret key, not the anon public key.
* Keep `AUTO_SEND=false` during testing.
* Set `AUTO_SEND=true` only after live credentials are fully tested.

## Supabase Tables

The system uses three main tables:

* `inbox_conversations`
* `inbox_messages`
* `inbox_logs`

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
2. Choose a channel: WhatsApp, Facebook, Instagram, Email, or Manual.
3. Enter customer details.
4. Write an inbound message.
5. Click "Generate AI Reply".
6. The system will:

   * Save the conversation
   * Save the inbound message
   * Detect intent
   * Calculate lead score
   * Decide if human review is needed
   * Generate an AI or fallback reply
   * Save the outbound reply
   * Add an activity log

## Safe Demo Mode

By default:

```env
AUTO_SEND=false
```

This means the system generates and saves replies, but it does not send real messages to WhatsApp, Facebook, Instagram, or Email.

This is recommended for testing and demos.

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

## Business Use Case

MetaFlow AI Inbox helps businesses stop losing leads from scattered inboxes.

It is useful for:

* Clinics
* Medspas
* Real estate agencies
* Home service companies
* Gyms and fitness coaches
* Local service businesses
* Agencies
* E-commerce brands

## Value Proposition

MetaFlow helps businesses:

* Reply faster to inbound leads
* Centralize WhatsApp, Instagram, Facebook, and Email messages
* Identify high-intent leads
* Reduce manual inbox work
* Prioritize conversations that need human follow-up
* Export leads for sales follow-up

## Author

Built by Ziad Mohamed.
