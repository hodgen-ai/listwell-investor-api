# Listwell Investor API

Minimal backend for the Listwell investor landing page. Receives form submissions and routes them through Resend for notifications + drip sequences.

## Setup on Replit

1. **Create a new Repl** → Import this folder (or connect via GitHub)
2. **Click the padlock icon** (Secrets) and add these environment variables:

| Secret | Value | Required |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` from [resend.com/api-keys](https://resend.com/api-keys) | ✅ |
| `RESEND_AUDIENCE_ID` | From Resend → Audiences → copy ID | ✅ for drip |
| `NOTIFY_EMAIL` | `mike@hodgen.ai` (where you get alerts) | Optional (defaults to mike@hodgen.ai) |
| `FROM_EMAIL` | `Listwell <invest@listwell.ai>` | Optional (must be verified domain) |
| `ALLOWED_ORIGIN` | `https://listwell.ai` or your landing page URL | Optional (defaults to * for dev) |

3. **Hit Run** — it installs deps and starts the server
4. **Copy your Replit URL** (e.g. `https://listwell-investor-api.yourusername.repl.co`)
5. **Update the landing page** — replace `YOUR_BACKEND` in the form JS with your Replit URL

## Resend Setup

1. Go to [resend.com](https://resend.com) → create API key
2. **Verify your domain** (Settings → Domains) if you want to send from `@listwell.ai`
   - Or use Resend's default `onboarding@resend.dev` for testing
3. **Create an Audience** (for drip sequences) → copy the audience ID
4. Optionally set up a **Broadcast** or **drip sequence** in Resend to auto-send:
   - Deal memo PDF
   - QSBS explainer
   - Term sheet
   - Follow-up / scheduling link

## API

### `POST /api/investor-interest`

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "investment_range": "50k-100k",
  "source": "listwell-landing",
  "timestamp": "2026-02-05T21:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Interest received. We'll be in touch within 48 hours."
}
```

### `GET /`
Health check — returns `{ "status": "ok" }`

## Landing Page Integration

In the landing page HTML, the form JS posts to your backend:

```js
await fetch('https://YOUR-REPLIT-URL.repl.co/api/investor-interest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, investment_range, source: 'listwell-landing', timestamp: new Date().toISOString() })
});
```

## Rate Limiting

5 submissions per IP per hour (in-memory). Resets on Repl restart. Good enough for low-volume investor forms.
