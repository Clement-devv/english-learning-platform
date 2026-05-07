import { Resend } from "resend";
import nodemailer from "nodemailer";
import { config } from "../config/config.js";
import logger from "../utils/logger.js";

/**
 * Resolve the correct base URL for email links sent to a center's users.
 * - Custom domain verified → https://www.sunshine.com (no ?center= slug needed)
 * - Otherwise            → FRONTEND_URL + ?center=slug as fallback
 */
export const getCenterBaseUrl = (center) => {
  if (center?.customDomain && center?.domainVerified) {
    return { baseUrl: `https://${center.customDomain}`, needsSlug: false };
  }
  return { baseUrl: config.frontendUrl, needsSlug: true };
};

// ── Transport selection ───────────────────────────────────────────────────────
// Use Resend HTTP API (port 443) when RESEND_API_KEY is set — works on VPS
// providers that block all outbound SMTP ports.
// Falls back to nodemailer for local development.

const useResend = !!process.env.RESEND_API_KEY;
const resendClient = useResend ? new Resend(process.env.RESEND_API_KEY) : null;

const smtpTransporter = !useResend
  ? nodemailer.createTransport({
      host:              config.emailHost,
      port:              config.emailPort,
      secure:            config.emailPort === 465,
      requireTLS:        config.emailPort === 587,
      connectionTimeout: 10_000,
      greetingTimeout:   10_000,
      socketTimeout:     15_000,
      auth: { user: config.emailUser, pass: config.emailPassword },
      tls: { rejectUnauthorized: false },
    })
  : null;

// ── verifyEmailConfig ─────────────────────────────────────────────────────────
export const verifyEmailConfig = async () => {
  if (useResend) {
    logger.info(`📧 Email via Resend HTTP API — from: ${config.emailFrom || process.env.EMAIL_FROM}`);
    logger.info("✅ Email service is ready (Resend)");
    return true;
  }
  logger.info(`📧 Email via SMTP — host: ${config.emailHost}, port: ${config.emailPort}, user: ${config.emailUser || "(not set)"}`);
  try {
    await smtpTransporter.verify();
    logger.info("✅ Email service is ready (SMTP)");
    return true;
  } catch (error) {
    logger.error("❌ Email service error:", { error: error?.message });
    return false;
  }
};

// ── sendEmail ─────────────────────────────────────────────────────────────────
export const sendEmail = async (mailOptions) => {
  const { centerName, to, subject, html, text, replyTo } = mailOptions;
  const from = `${centerName || config.appName} <${process.env.EMAIL_FROM || config.emailFrom || config.emailUser}>`;

  if (useResend) {
    try {
      const { data, error } = await resendClient.emails.send({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(text   && { text }),
        ...(replyTo && { replyTo }),
      });
      if (error) {
        logger.error("❌ Resend send failed:", { error: error.message });
        return { success: false, error: error.message };
      }
      logger.info("📧 Email sent via Resend:", data.id);
      return { success: true, messageId: data.id };
    } catch (err) {
      logger.error("❌ Resend exception:", { error: err?.message });
      return { success: false, error: err.message };
    }
  }

  try {
    const info = await smtpTransporter.sendMail({ from, to, subject, html, text, replyTo });
    logger.info("📧 Email sent via SMTP:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("❌ SMTP send failed:", { error: error?.message });
    return { success: false, error: error.message };
  }
};
