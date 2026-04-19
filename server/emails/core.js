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

const transporter = nodemailer.createTransport({
  host:       config.emailHost,
  port:       config.emailPort,
  secure:     config.emailPort === 465,
  requireTLS: config.emailPort === 587,
  auth: {
    user: config.emailUser,
    pass: config.emailPassword,
  },
  tls: { rejectUnauthorized: false },
  debug: false,
  logger: false,
});

export const verifyEmailConfig = async () => {
  logger.info(`📧 Email config — host: ${config.emailHost}, port: ${config.emailPort}, user: ${config.emailUser || "(not set)"}`);
  try {
    await transporter.verify();
    logger.info("✅ Email service is ready");
    return true;
  } catch (error) {
    logger.error("❌ Email service error:", { error: error?.message });
    logger.error("⚠️ Email notifications will be disabled");
    return false;
  }
};

export const sendEmail = async (mailOptions) => {
  try {
    const { centerName, ...opts } = mailOptions;
    const info = await transporter.sendMail({
      ...opts,
      from: `"${centerName || config.appName}" <${config.emailFrom}>`,
    });
    logger.info("📧 Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("❌ Email send failed:", { error: error?.message });
    return { success: false, error: error.message };
  }
};
