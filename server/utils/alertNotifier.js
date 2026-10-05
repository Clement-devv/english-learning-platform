// server/utils/alertNotifier.js
// Tells the super admin about a red health check — by email and WhatsApp.
// WhatsApp is the backup for when email itself is what's broken.
//
// Where alerts go is set on the App Health tab (MonitorState "settings").
// WhatsApp needs ONE of these providers in server/.env:
//   Twilio:    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. +14155238886)
//   CallMeBot: CALLMEBOT_API_KEY  (free, for messaging your own number — see docs/monitoring.md)
import SuperAdmin from "../models/master/SuperAdmin.js";
import MonitorState from "../models/master/MonitorState.js";
import { sendEmail } from "./emailService.js";
import { config } from "../config/config.js";
import logger from "./logger.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fetchTimeout = (url, opts = {}) => fetch(url, { ...opts, signal: AbortSignal.timeout(10_000) });

export const whatsappProvider = () => {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) return "twilio";
  if (process.env.CALLMEBOT_API_KEY) return "callmebot";
  return null;
};

const DEFAULTS = { emailEnabled: true, whatsappEnabled: true, alertEmails: [], whatsappPhone: "" };

export async function getAlertSettings() {
  const doc = await MonitorState.findById("settings").lean();
  return { ...DEFAULTS, ...(doc || {}) };
}

/** Alert emails: the ones set on the dashboard, else every super admin's email. */
async function alertEmails(settings) {
  if (settings.alertEmails?.length) return settings.alertEmails;
  const admins = await SuperAdmin.find({}).select("email").lean();
  return admins.map(a => a.email).filter(Boolean);
}

async function sendWhatsApp(phone, text) {
  const to = String(phone || "").replace(/[^\d+]/g, "");
  if (!/^\+\d{7,15}$/.test(to)) return "failed: WhatsApp number must be in international format, e.g. +2348012345678";
  const provider = whatsappProvider();
  if (!provider) return "off: no WhatsApp provider set in server/.env";
  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const from = String(process.env.TWILIO_WHATSAPP_FROM).replace(/^whatsapp:/, "");
      const res = await fetchTimeout(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${from}`, Body: text.slice(0, 1500) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return `failed: Twilio ${res.status} ${body.message || ""}`.trim();
      }
      return "sent";
    }
    // CallMeBot only accepts GET with the text in the query string
    const url = `https://api.callmebot.com/whatsapp.php?${new URLSearchParams({ phone: to, text: text.slice(0, 1000), apikey: process.env.CALLMEBOT_API_KEY })}`;
    const res = await fetchTimeout(url);
    const body = await res.text().catch(() => "");
    if (!res.ok || /error|invalid/i.test(body.slice(0, 300))) return `failed: CallMeBot ${res.status}`;
    return "sent";
  } catch (err) {
    return `failed: ${err?.name === "TimeoutError" ? "timed out" : err?.message}`;
  }
}

/**
 * Send one alert on every switched-on channel.
 * @param {{ title: string, message: string, details?: string[], level: "fail"|"resolved"|"test"|"reminder" }} a
 * @returns {{ email: string, whatsapp: string }} what happened on each channel
 */
export async function notifySuperAdmin(a) {
  const settings = await getAlertSettings();
  const icon = { fail: "🔴", resolved: "✅", test: "🧪", reminder: "🔴" }[a.level] || "🔔";
  const heading = { fail: "Problem", resolved: "Fixed", test: "Test alert", reminder: "Still failing" }[a.level] || "Alert";
  const details = (a.details || []).slice(0, 8);
  const dashUrl = `${config.frontendUrl || ""}/super-admin/dashboard`;

  const out = { email: "off", whatsapp: "off" };
  const jobs = [];

  if (settings.emailEnabled) {
    jobs.push((async () => {
      const to = await alertEmails(settings);
      if (!to.length) { out.email = "failed: no alert email set"; return; }
      const r = await sendEmail({
        kind: "App Health alert", centerSlug: null,
        to,
        subject: `${icon} ${heading}: ${a.title}`,
        html: `<p style="font-size:16px"><strong>${icon} ${esc(heading)}: ${esc(a.title)}</strong></p>
<p>${esc(a.message)}</p>
${details.length ? `<ul>${details.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
<p><a href="${esc(dashUrl)}">Open App Health</a></p>
<p style="color:#64748b;font-size:12px">Sent ${new Date().toUTCString()} by your platform's health monitor.</p>`,
      });
      out.email = r?.success ? "sent" : `failed: ${r?.error || "send failed"}`;
    })());
  }

  if (settings.whatsappEnabled && settings.whatsappPhone) {
    jobs.push((async () => {
      const text = [`${icon} ${heading}: ${a.title}`, a.message, ...details.map(d => `• ${d}`), dashUrl].filter(Boolean).join("\n");
      out.whatsapp = await sendWhatsApp(settings.whatsappPhone, text);
    })());
  } else if (settings.whatsappEnabled) {
    out.whatsapp = "off: no WhatsApp number set";
  }

  await Promise.allSettled(jobs);
  if (/^failed/.test(out.email) || /^failed/.test(out.whatsapp)) {
    logger.warn("App Health alert delivery problem", { title: a.title, ...out });
  }
  return out;
}
