require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "metaflow_verify_123";
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

const AUTO_SEND = String(process.env.AUTO_SEND || "false").toLowerCase() === "true";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

const allowedChannels = ["whatsapp", "facebook", "instagram", "email", "manual"];

function normalizeChannel(channel) {
  const clean = String(channel || "manual").toLowerCase().trim();
  return allowedChannels.includes(clean) ? clean : "manual";
}

function nowIso() {
  return new Date().toISOString();
}

function getBaseUrl(req) {
  const host = req.get("host");
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${protocol}://${host}`;
}

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return "";
}

function getRequestAdminToken(req) {
  return (
    req.headers["x-admin-token"] ||
    req.query.admin_token ||
    req.body?.admin_token ||
    getCookieValue(req, "metaflow_admin_token") ||
    ""
  );
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return next();
  }

  const incomingToken = getRequestAdminToken(req);

  if (incomingToken === ADMIN_TOKEN) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: "Unauthorized. Admin token is required."
  });
}

async function addLog(action, channel = "", conversationId = null, details = "") {
  try {
    await supabase.from("inbox_logs").insert({
      action,
      channel,
      conversation_id: conversationId,
      details
    });
  } catch (err) {
    console.error("Log error:", err.message);
  }
}

function detectIntent(messageText = "") {
  const text = messageText.toLowerCase();

  if (
    text.includes("price") ||
    text.includes("cost") ||
    text.includes("quote") ||
    text.includes("pricing") ||
    text.includes("budget") ||
    text.includes("سعر") ||
    text.includes("تكلفة") ||
    text.includes("عرض سعر") ||
    text.includes("بكام")
  ) {
    return "Pricing / Quote";
  }

  if (
    text.includes("book") ||
    text.includes("appointment") ||
    text.includes("call") ||
    text.includes("meeting") ||
    text.includes("schedule") ||
    text.includes("احجز") ||
    text.includes("حجز") ||
    text.includes("مكالمة") ||
    text.includes("ميعاد") ||
    text.includes("اقابل")
  ) {
    return "Booking / Appointment";
  }

  if (
    text.includes("support") ||
    text.includes("problem") ||
    text.includes("issue") ||
    text.includes("help") ||
    text.includes("مشاكل") ||
    text.includes("مشكلة") ||
    text.includes("مساعدة")
  ) {
    return "Support";
  }

  if (
    text.includes("buy") ||
    text.includes("order") ||
    text.includes("interested") ||
    text.includes("purchase") ||
    text.includes("عايز") ||
    text.includes("مهتم") ||
    text.includes("اشتري") ||
    text.includes("طلب")
  ) {
    return "Buying Intent";
  }

  return "General Inquiry";
}

function calculateLeadScore(messageText = "", customer = {}) {
  const text = messageText.toLowerCase();
  let score = 10;

  const highIntentWords = [
    "price",
    "quote",
    "pricing",
    "cost",
    "book",
    "buy",
    "order",
    "urgent",
    "today",
    "call",
    "appointment",
    "interested",
    "budget",
    "سعر",
    "عرض سعر",
    "تكلفة",
    "احجز",
    "حجز",
    "اشتري",
    "عايز",
    "مهتم",
    "مكالمة",
    "النهاردة",
    "مستعجل"
  ];

  for (const word of highIntentWords) {
    if (text.includes(word)) score += 10;
  }

  if (customer.customer_phone) score += 15;
  if (customer.customer_email) score += 15;
  if (text.length > 80) score += 10;
  if (text.includes("?") || text.includes("؟")) score += 5;

  return Math.min(score, 100);
}

function needsHumanReview(messageText = "", leadScore = 0) {
  const text = messageText.toLowerCase();

  const humanWords = [
    "angry",
    "refund",
    "cancel",
    "complaint",
    "legal",
    "lawsuit",
    "scam",
    "urgent",
    "manager",
    "غاضب",
    "استرجاع",
    "إلغاء",
    "الغاء",
    "شكوى",
    "نصب",
    "مدير",
    "قانوني",
    "مستعجل"
  ];

  if (leadScore >= 80) return true;

  return humanWords.some((word) => text.includes(word));
}

async function generateAiReply({ channel, messageText, customerName, intent, leadScore }) {
  function buildProfessionalFallbackReply() {
    const name = customerName ? customerName.split(" ")[0] : "";
    const greeting = name ? `Hi ${name},` : "Hi there,";
    const text = String(messageText || "").toLowerCase();
    const isHighIntent = Number(leadScore || 0) >= 70;

    if (intent === "Pricing / Quote") {
      if (isHighIntent) {
        return `${greeting} thanks for reaching out. I can help you with pricing, but I’ll need a few details first so we can give you an accurate quote. What service or package are you interested in, and what timeline are you aiming for? If you prefer, I can also help schedule a quick call.`;
      }

      return `${greeting} thanks for your message. I can help with pricing. Could you share a little more about what you need, your timeline, and any specific requirements?`;
    }

    if (intent === "Booking / Appointment") {
      return `${greeting} absolutely — we can help schedule that. What day and time works best for you, and what would you like to cover during the call?`;
    }

    if (intent === "Support") {
      return `${greeting} thanks for letting us know. I’m sorry you’re facing an issue. Please send a few more details about what happened, and our team will review it carefully and follow up with the best next step.`;
    }

    if (intent === "Buying Intent") {
      return `${greeting} thanks for your interest. We can help you choose the right option. What are you looking to achieve, and do you have a preferred timeline or budget range?`;
    }

    if (
      text.includes("urgent") ||
      text.includes("today") ||
      text.includes("asap") ||
      text.includes("مستعجل") ||
      text.includes("النهاردة")
    ) {
      return `${greeting} thanks for reaching out. This sounds time-sensitive, so I’ll make sure it gets reviewed quickly. What’s the best phone number or time for the team to contact you?`;
    }

    return `${greeting} thanks for your message. We received your request and can help you with the next step. Could you share a bit more detail about what you need and the best way to contact you?`;
  }

  const fallbackReply = buildProfessionalFallbackReply();

  if (!openai) {
    return {
      reply: fallbackReply,
      source: "fallback-demo"
    };
  }

  const systemPrompt = `
You are MetaFlow AI Inbox, a professional sales and support assistant.

Rules:
- Reply naturally and briefly.
- Sound helpful, human, and professional.
- Ask one useful follow-up question if needed.
- Do not invent prices, dates, offers, or unavailable details.
- If the lead is high-intent, suggest a call or ask for the best time.
- If the message is in Arabic, reply in Arabic.
- If the message is in English, reply in English.
- Keep reply under 90 words.
`;

  const userPrompt = `
Channel: ${channel}
Customer name: ${customerName || "Unknown"}
Intent: ${intent}
Lead score: ${leadScore}

Customer message:
${messageText}
`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5
    });

    const generatedText = response.choices?.[0]?.message?.content?.trim();

    return {
      reply: generatedText || fallbackReply,
      source: generatedText ? "openai" : "fallback-demo"
    };
  } catch (err) {
    console.error("OpenAI error:", err.message);

    return {
      reply: fallbackReply,
      source: "fallback-demo"
    };
  }
}

async function findOrCreateConversation(payload) {
  const channel = normalizeChannel(payload.channel);

  const customerPlatformId =
    payload.customer_platform_id ||
    payload.customer_email ||
    payload.customer_phone ||
    `manual_${Date.now()}`;

  const platformConversationId =
    payload.platform_conversation_id ||
    `${channel}_${customerPlatformId}`;

  const { data: existing, error: findError } = await supabase
    .from("inbox_conversations")
    .select("*")
    .eq("channel", channel)
    .eq("customer_platform_id", customerPlatformId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("inbox_conversations")
    .insert({
      channel,
      platform_conversation_id: platformConversationId,
      customer_name: payload.customer_name || "",
      customer_platform_id: customerPlatformId,
      customer_phone: payload.customer_phone || "",
      customer_email: payload.customer_email || "",
      last_message: "",
      last_ai_reply: "",
      status: "New",
      intent: "Unknown",
      lead_score: 0,
      needs_human: false,
      source: payload.source || "MetaFlow"
    })
    .select("*")
    .single();

  if (createError) throw createError;

  await addLog("Conversation created", channel, created.id, `Customer: ${customerPlatformId}`);

  return created;
}

async function saveMessage({
  conversationId,
  channel,
  direction,
  senderType,
  messageText,
  platformMessageId = "",
  aiModel = ""
}) {
  const { data, error } = await supabase
    .from("inbox_messages")
    .insert({
      conversation_id: conversationId,
      channel,
      direction,
      sender_type: senderType,
      message_text: messageText,
      platform_message_id: platformMessageId,
      ai_model: aiModel
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

async function updateConversation(conversationId, updates) {
  const { data, error } = await supabase
    .from("inbox_conversations")
    .update({
      ...updates,
      updated_at: nowIso()
    })
    .eq("id", conversationId)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

async function sendWhatsAppMessage(to, message) {
  if (!AUTO_SEND) {
    return { sent: false, demo: true, reason: "AUTO_SEND=false" };
  }

  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { sent: false, error: "Missing WhatsApp credentials" };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;

  const result = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  return { sent: true, data: result.data };
}

async function sendFacebookMessage(recipientId, message) {
  if (!AUTO_SEND) {
    return { sent: false, demo: true, reason: "AUTO_SEND=false" };
  }

  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!token) {
    return { sent: false, error: "Missing FACEBOOK_PAGE_ACCESS_TOKEN" };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`;

  const result = await axios.post(
    `${url}?access_token=${token}`,
    {
      recipient: { id: recipientId },
      message: { text: message }
    }
  );

  return { sent: true, data: result.data };
}

async function sendInstagramMessage(recipientId, message) {
  if (!AUTO_SEND) {
    return { sent: false, demo: true, reason: "AUTO_SEND=false" };
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!token) {
    return { sent: false, error: "Missing INSTAGRAM_ACCESS_TOKEN" };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`;

  const result = await axios.post(
    `${url}?access_token=${token}`,
    {
      recipient: { id: recipientId },
      message: { text: message }
    }
  );

  return { sent: true, data: result.data };
}

function createEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
}

async function sendEmailMessage(to, subject, message) {
  if (!AUTO_SEND) {
    return { sent: false, demo: true, reason: "AUTO_SEND=false" };
  }

  if (!to) {
    return { sent: false, error: "Missing recipient email" };
  }

  const transporter = createEmailTransporter();

  if (!transporter) {
    return { sent: false, error: "Missing SMTP settings" };
  }

  const fromName = process.env.EMAIL_FROM_NAME || "MetaFlow AI Inbox";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;

  const result = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject: subject || "Reply from MetaFlow AI Inbox",
    text: message
  });

  return { sent: true, data: result };
}

async function sendReplyByChannel(conversation, replyText) {
  const channel = normalizeChannel(conversation.channel);

  try {
    if (channel === "whatsapp") {
      return await sendWhatsAppMessage(conversation.customer_platform_id, replyText);
    }

    if (channel === "facebook") {
      return await sendFacebookMessage(conversation.customer_platform_id, replyText);
    }

    if (channel === "instagram") {
      return await sendInstagramMessage(conversation.customer_platform_id, replyText);
    }

    if (channel === "email") {
      return await sendEmailMessage(
        conversation.customer_email || conversation.customer_platform_id,
        "Re: Your message",
        replyText
      );
    }

    return {
      sent: false,
      demo: true,
      reason: "Manual channel - no real sending"
    };
  } catch (err) {
    console.error("Send reply error:", err.message);
    return { sent: false, error: err.message };
  }
}

async function processInboundMessage(payload) {
  const channel = normalizeChannel(payload.channel);
  const messageText = String(payload.message_text || "").trim();

  if (!messageText) {
    throw new Error("message_text is required");
  }

  const conversation = await findOrCreateConversation({
    ...payload,
    channel
  });

  await saveMessage({
    conversationId: conversation.id,
    channel,
    direction: "inbound",
    senderType: "customer",
    messageText,
    platformMessageId: payload.platform_message_id || ""
  });

  const intent = detectIntent(messageText);

  const leadScore = calculateLeadScore(messageText, {
    customer_phone: payload.customer_phone || conversation.customer_phone,
    customer_email: payload.customer_email || conversation.customer_email
  });

  const humanReview = needsHumanReview(messageText, leadScore);

  const aiGeneration = await generateAiReply({
    channel,
    messageText,
    customerName: payload.customer_name || conversation.customer_name,
    intent,
    leadScore
  });

  const aiReply = aiGeneration.reply;
  const aiModelLabel = aiGeneration.source === "openai" ? OPENAI_MODEL : "fallback-demo";

  await saveMessage({
    conversationId: conversation.id,
    channel,
    direction: "outbound",
    senderType: "ai",
    messageText: aiReply,
    aiModel: aiModelLabel
  });

  const updatedConversation = await updateConversation(conversation.id, {
    customer_name: payload.customer_name || conversation.customer_name || "",
    customer_phone: payload.customer_phone || conversation.customer_phone || "",
    customer_email: payload.customer_email || conversation.customer_email || "",
    last_message: messageText,
    last_ai_reply: aiReply,
    status: humanReview ? "Needs Review" : "AI Replied",
    intent,
    lead_score: leadScore,
    needs_human: humanReview,
    source: payload.source || conversation.source || "MetaFlow"
  });

  const sendResult = await sendReplyByChannel(updatedConversation, aiReply);

  await addLog(
    "Inbound processed",
    channel,
    conversation.id,
    `Intent: ${intent}, Score: ${leadScore}, Human review: ${humanReview}, AI source: ${aiModelLabel}, Sent: ${sendResult.sent}`
  );

  return {
    conversation: updatedConversation,
    ai_reply: aiReply,
    ai_source: aiModelLabel,
    send_result: sendResult
  };
}

function extractMetaMessages(body) {
  const results = [];
  const entries = body.entry || [];
  const objectType = String(body.object || "").toLowerCase();

  for (const entry of entries) {
    if (entry.changes) {
      for (const change of entry.changes) {
        const value = change.value || {};

        if (value.messages && value.contacts) {
          for (const msg of value.messages) {
            const contact = value.contacts?.[0] || {};
            const text =
              msg.text?.body ||
              msg.button?.text ||
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              "";

            results.push({
              channel: "whatsapp",
              customer_name: contact.profile?.name || "",
              customer_platform_id: msg.from,
              customer_phone: msg.from,
              customer_email: "",
              message_text: text,
              platform_message_id: msg.id || "",
              source: "WhatsApp Webhook"
            });
          }
        }
      }
    }

    if (entry.messaging) {
      for (const event of entry.messaging) {
        const senderId = event.sender?.id;
        const text = event.message?.text;
        const mid = event.message?.mid || "";

        if (senderId && text) {
          results.push({
            channel: objectType.includes("instagram") ? "instagram" : "facebook",
            customer_name: "",
            customer_platform_id: senderId,
            customer_phone: "",
            customer_email: "",
            message_text: text,
            platform_message_id: mid,
            source: objectType.includes("instagram")
              ? "Instagram Webhook"
              : "Facebook Messenger Webhook"
          });
        }
      }
    }
  }

  return results;
}

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/health", async (req, res) => {
  res.json({
    ok: true,
    app: "MetaFlow AI Inbox",
    auto_send: AUTO_SEND,
    openai_key_found: Boolean(openai),
    openai_model: OPENAI_MODEL,
    supabase_ready: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
    admin_protection_enabled: Boolean(ADMIN_TOKEN),
    webhook_url: `${getBaseUrl(req)}/webhooks/meta`,
    email_webhook_url: `${getBaseUrl(req)}/webhooks/email`,
    time: nowIso()
  });
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhooks/meta", async (req, res) => {
  try {
    const messages = extractMetaMessages(req.body);
    const processed = [];

    for (const message of messages) {
      if (message.message_text) {
        const result = await processInboundMessage(message);
        processed.push(result);
      }
    }

    await addLog(
      "Meta webhook received",
      "meta",
      null,
      `Processed messages: ${processed.length}`
    );

    res.status(200).json({
      success: true,
      processed_count: processed.length,
      processed
    });
  } catch (err) {
    console.error("Meta webhook error:", err.message);

    await addLog("Meta webhook error", "meta", null, err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/webhooks/email", async (req, res) => {
  try {
    const payload = {
      channel: "email",
      customer_name: req.body.customer_name || req.body.from_name || "",
      customer_platform_id:
        req.body.customer_platform_id ||
        req.body.customer_email ||
        req.body.from_email ||
        req.body.email ||
        `email_${Date.now()}`,
      customer_email:
        req.body.customer_email ||
        req.body.from_email ||
        req.body.email ||
        "",
      customer_phone: req.body.customer_phone || "",
      message_text:
        req.body.message_text ||
        req.body.text ||
        req.body.body ||
        req.body.message ||
        "",
      platform_message_id: req.body.platform_message_id || req.body.message_id || "",
      source: req.body.source || "Email Webhook"
    };

    const result = await processInboundMessage(payload);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("Email webhook error:", err.message);

    await addLog("Email webhook error", "email", null, err.message);

    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/simulate/inbound", requireAdmin, async (req, res) => {
  try {
    const result = await processInboundMessage(req.body);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("Simulate inbound error:", err.message);

    await addLog(
      "Simulate inbound error",
      req.body.channel || "manual",
      null,
      err.message
    );

    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/conversations", requireAdmin, async (req, res) => {
  try {
    const channel = req.query.channel;
    const status = req.query.status;
    const search = req.query.search;

    let query = supabase
      .from("inbox_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (channel && channel !== "all") {
      query = query.eq("channel", normalizeChannel(channel));
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      const cleanSearch = String(search).replace(/[%(),]/g, "");
      query = query.or(
        `customer_name.ilike.%${cleanSearch}%,customer_platform_id.ilike.%${cleanSearch}%,customer_email.ilike.%${cleanSearch}%,customer_phone.ilike.%${cleanSearch}%,last_message.ilike.%${cleanSearch}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      conversations: data || []
    });
  } catch (err) {
    console.error("Get conversations error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/conversations/:id/messages", requireAdmin, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);

    const { data: conversation, error: conversationError } = await supabase
      .from("inbox_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (conversationError) throw conversationError;

    const { data: messages, error: messagesError } = await supabase
      .from("inbox_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    res.json({
      success: true,
      conversation,
      messages: messages || []
    });
  } catch (err) {
    console.error("Get messages error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.put("/conversations/:id/status", requireAdmin, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const status = req.body.status || "New";

    const data = await updateConversation(conversationId, {
      status,
      needs_human: status === "Needs Review"
    });

    await addLog(
      "Status updated",
      data.channel,
      conversationId,
      `New status: ${status}`
    );

    res.json({
      success: true,
      conversation: data
    });
  } catch (err) {
    console.error("Update status error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/conversations/:id/human-reply", requireAdmin, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const replyText = String(req.body.message_text || "").trim();

    if (!replyText) {
      return res.status(400).json({
        success: false,
        error: "message_text is required"
      });
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("inbox_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (conversationError) throw conversationError;

    await saveMessage({
      conversationId,
      channel: conversation.channel,
      direction: "outbound",
      senderType: "human",
      messageText: replyText
    });

    const sendResult = await sendReplyByChannel(conversation, replyText);

    const updatedConversation = await updateConversation(conversationId, {
      last_ai_reply: replyText,
      status: "Human Replied",
      needs_human: false
    });

    await addLog(
      "Human reply saved",
      conversation.channel,
      conversationId,
      `Sent: ${sendResult.sent}, AUTO_SEND: ${AUTO_SEND}`
    );

    res.json({
      success: true,
      conversation: updatedConversation,
      send_result: sendResult
    });
  } catch (err) {
    console.error("Human reply error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/demo/seed", requireAdmin, async (req, res) => {
  try {
    const demoMessages = [
      {
        channel: "whatsapp",
        customer_name: "Ahmed Hassan",
        customer_platform_id: "201001112233",
        customer_phone: "201001112233",
        customer_email: "",
        message_text: "Hi, I want to know the price and book a call today.",
        source: "WhatsApp Demo"
      },
      {
        channel: "instagram",
        customer_name: "Sara Ali",
        customer_platform_id: "ig_sara_102",
        customer_phone: "",
        customer_email: "",
        message_text: "I saw your ad and I am interested. How much does it cost?",
        source: "Instagram Demo"
      },
      {
        channel: "facebook",
        customer_name: "Omar Mostafa",
        customer_platform_id: "fb_omar_200",
        customer_phone: "",
        customer_email: "",
        message_text: "Can someone help me? I have a problem and need support.",
        source: "Facebook Demo"
      },
      {
        channel: "email",
        customer_name: "Nour Adel",
        customer_platform_id: "nour@example.com",
        customer_phone: "",
        customer_email: "nour@example.com",
        message_text: "Hello, please send me a quote for your automation service.",
        source: "Email Demo"
      }
    ];

    const results = [];

    for (const msg of demoMessages) {
      const result = await processInboundMessage(msg);
      results.push(result.conversation);
    }

    res.json({
      success: true,
      created: results.length,
      conversations: results
    });
  } catch (err) {
    console.error("Demo seed error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.delete("/demo/clear", requireAdmin, async (req, res) => {
  try {
    const { error: messagesError } = await supabase
      .from("inbox_messages")
      .delete()
      .neq("id", 0);

    if (messagesError) throw messagesError;

    const { error: conversationsError } = await supabase
      .from("inbox_conversations")
      .delete()
      .neq("id", 0);

    if (conversationsError) throw conversationsError;

    const { error: logsError } = await supabase
      .from("inbox_logs")
      .delete()
      .neq("id", 0);

    if (logsError) throw logsError;

    await addLog("Demo data cleared", "system", null, "All MetaFlow inbox demo data was cleared");

    res.json({
      success: true,
      message: "Demo inbox data cleared"
    });
  } catch (err) {
    console.error("Clear demo data error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/logs", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("inbox_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({
      success: true,
      logs: data || []
    });
  } catch (err) {
    console.error("Logs error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.get("/export/csv", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("inbox_conversations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = data || [];

    const headers = [
      "id",
      "channel",
      "customer_name",
      "customer_platform_id",
      "customer_phone",
      "customer_email",
      "status",
      "intent",
      "lead_score",
      "needs_human",
      "source",
      "last_message",
      "last_ai_reply",
      "created_at",
      "updated_at"
    ];

    const escapeCsv = (value) => {
      const clean = String(value ?? "").replace(/"/g, '""');
      return `"${clean}"`;
    };

    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(","))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=metaflow-ai-inbox.csv");
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`MetaFlow AI Inbox running on http://localhost:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`AUTO_SEND=${AUTO_SEND}`);
    console.log(`Admin protection enabled: ${Boolean(ADMIN_TOKEN)}`);
  });
}

module.exports = app;