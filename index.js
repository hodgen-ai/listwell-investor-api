const express = require("express");
const cors = require("cors");
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIG — Set these in Replit Secrets (padlock icon in sidebar)
// ============================================================
// RESEND_API_KEY       → re_xxxxxxxxxxxx (from resend.com/api-keys)
// RESEND_AUDIENCE_ID   → from Resend dashboard → Audiences
// NOTIFY_EMAIL         → where you get notified (default: mike@hodgen.ai)
// FROM_EMAIL           → must be a verified domain in Resend
// ALLOWED_ORIGIN       → your landing page URL (e.g. https://listwell.ai)
// ============================================================

const path = require("path");
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["POST", "GET"],
  })
);

// Serve the landing page
app.use(express.static(path.join(__dirname, "public")));

// --- Simple rate limiting (5 per IP per hour) ---
const rateLimit = new Map();
function checkRate(ip) {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const max = 5;
  const hits = (rateLimit.get(ip) || []).filter((t) => now - t < window);
  if (hits.length >= max) return false;
  hits.push(now);
  rateLimit.set(ip, hits);
  return true;
}

// --- Main endpoint ---
app.post("/api/investor-interest", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.ip;
  if (!checkRate(ip)) {
    return res.status(429).json({ error: "Too many submissions. Try again later." });
  }

  const { name, email, investment_range, source, timestamp } = req.body;

  // Validate
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const notifyEmail = process.env.NOTIFY_EMAIL || "mike@hodgen.ai";
  const fromEmail = process.env.FROM_EMAIL || "Listwell <invest@listwell.ai>";
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  const results = { notification: null, contact: null, errors: [] };

  // 1. Send notification email to you
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: notifyEmail,
      subject: `🟢 New Investor Interest: ${name} (${investment_range || "not specified"})`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px;">
          <h2 style="color: #1a1a2e;">New Investor Interest</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${name}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Range</td><td style="padding: 8px 0; font-weight: 600;">${investment_range || "—"}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Source</td><td style="padding: 8px 0;">${source || "direct"}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0;">${timestamp || new Date().toISOString()}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 13px;">Reply directly to this email to reach ${email}</p>
        </div>
      `,
      reply_to: email,
    });

    if (error) {
      results.errors.push({ step: "notification", error });
      console.error("Notification error:", error);
    } else {
      results.notification = data;
      console.log(`✅ Notification sent for ${name} (${email})`);
    }
  } catch (err) {
    results.errors.push({ step: "notification", error: err.message });
    console.error("Notification exception:", err);
  }

  // 2. Add to Resend audience (for drip sequence)
  if (audienceId) {
    try {
      const firstName = name.split(" ")[0];
      const lastName = name.split(" ").slice(1).join(" ") || "";

      const { data, error } = await resend.contacts.create({
        email,
        firstName,
        lastName,
        unsubscribed: false,
        audienceId,
      });

      if (error) {
        results.errors.push({ step: "contact", error });
        console.error("Contact error:", error);
      } else {
        results.contact = data;
        console.log(`✅ Contact added: ${email} → audience ${audienceId}`);
      }
    } catch (err) {
      results.errors.push({ step: "contact", error: err.message });
      console.error("Contact exception:", err);
    }
  }

  // Always return success to the user (graceful degradation)
  res.json({
    success: true,
    message: "Interest received. We'll be in touch within 48 hours.",
  });
});

app.listen(PORT, () => {
  console.log(`\n🟢 Listwell Investor API running on port ${PORT}`);
  console.log(`   POST /api/investor-interest`);
  console.log(`   Resend API key: ${process.env.RESEND_API_KEY ? "✅ configured" : "❌ missing — set in Secrets"}`);
  console.log(`   Audience ID:    ${process.env.RESEND_AUDIENCE_ID ? "✅ configured" : "⚠️  missing — contacts won't be saved"}`);
  console.log(`   Notify email:   ${process.env.NOTIFY_EMAIL || "mike@hodgen.ai (default)"}\n`);
});

module.exports = app;
