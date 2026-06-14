# MetaFlow AI Inbox - Client Onboarding Checklist

This checklist is used when setting up MetaFlow AI Inbox for a real client.

The goal is to connect the client's real Meta, WhatsApp, Instagram, Facebook, and email assets safely without asking for passwords.

## Important Rule

Do not ask the client for passwords.

The client should give access through:

- Meta Business Manager
- Facebook Page access
- Instagram professional account access
- WhatsApp Business setup access
- Email/SMTP credentials if email sending is needed

## What We Need From The Client

### 1. Business Information

- Business name
- Website
- Main service or offer
- Target customers
- Service area
- Main contact person
- Preferred response tone
- Common customer questions
- Pricing rules or quote process
- Booking link if available

### 2. Meta Business Access

The client should add us to their Meta Business Manager or provide partner access.

Needed access:

- Facebook Page access
- Instagram account access
- WhatsApp Business account access
- Permission to manage messaging integrations
- Permission to configure webhooks

### 3. Facebook Messenger Requirements

To connect Facebook Messenger, we need:

- Facebook Page ID
- Facebook Page access
- Page Access Token
- Messenger Webhook subscription
- Permission to receive and send messages

MetaFlow variables:

```env
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
```

### 4. Instagram DM Requirements

To connect Instagram DMs, the client needs:

- Instagram Business or Creator account
- Instagram account connected to a Facebook Page
- Permission to manage Instagram messaging
- Instagram Business ID
- Instagram access token or page token with Instagram messaging permissions

MetaFlow variables:

```env
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ID=
```

### 5. WhatsApp Cloud API Requirements

To connect WhatsApp, the client needs:

- WhatsApp Business Account
- Business phone number
- Phone Number ID
- Meta access token
- Webhook configured
- Message template approval if sending messages outside the customer service window

MetaFlow variables:

```env
META_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

### 6. Meta Webhook Setup

Use this callback URL:

```txt
https://metaflow-ai-inbox.vercel.app/webhooks/meta
```

Use this verify token:

```txt
metaflow_verify_123
```

Subscribe to the required messaging fields.

For WhatsApp, subscribe to:

```txt
messages
```

### 7. Email Setup

If the client wants email replies, we need SMTP details.

MetaFlow variables:

```env
EMAIL_FROM_NAME=
EMAIL_FROM_ADDRESS=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
```

### 8. Safe Testing Process

Start with:

```env
AUTO_SEND=false
```

This means:

- Inbound messages are received
- Conversations are saved
- Replies are generated
- Human review is detected
- Nothing is sent live

After testing and approval, change to:

```env
AUTO_SEND=true
```

### 9. Testing Checklist

Before going live:

- Test dashboard access using admin token
- Test manual simulation
- Test WhatsApp inbound message
- Test Facebook Messenger inbound message
- Test Instagram DM inbound message
- Test email webhook
- Confirm conversations appear in dashboard
- Confirm intent detection works
- Confirm lead scoring works
- Confirm human review works
- Confirm CSV export works
- Confirm human reply workflow works
- Confirm AUTO_SEND is still false during testing

### 10. Go-Live Checklist

Before setting `AUTO_SEND=true`:

- Client approves reply style
- Client approves AI behavior
- Client confirms business rules
- Client confirms escalation rules
- Client confirms phone/email details
- Meta tokens are valid
- WhatsApp sending is tested
- Facebook Messenger sending is tested
- Instagram sending is tested
- Email sending is tested
- Dashboard is protected by admin token

### 11. Client Questions To Ask

Ask the client:

1. What are the top 10 questions customers ask?
2. What should the system never say?
3. When should a human take over?
4. What is considered a high-quality lead?
5. What is the usual booking process?
6. Do you want AI to suggest calls?
7. Do you want AI to mention prices or only collect details?
8. What tone should replies use?
9. What channels do you use most?
10. Who will handle human replies?

### 12. Recommended Sales Positioning

Offer:

```txt
We install an AI inbox that replies to your WhatsApp, Instagram, Facebook, and email leads automatically, scores each conversation, and shows your team who needs human follow-up.
```

Main value:

- Faster replies
- Fewer lost leads
- One inbox for all channels
- Better lead prioritization
- Less manual work
- Higher booking rate

### 13. Recommended First Client Offer

For the first case study:

```txt
$150-$300 setup
+
$50-$100/month support
```

After the first successful case study:

```txt
$500-$1000 setup
+
$150-$300/month support
```

### 14. Security Notes

- Never store client passwords.
- Never send API keys in screenshots.
- Keep `.env` out of GitHub.
- Use Vercel Environment Variables.
- Use Supabase service role only on the backend.
- Keep admin token private.
- Start with AUTO_SEND=false.