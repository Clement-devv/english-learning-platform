// server/utils/meetingLinks.js
// Google Meet / Zoom links that teachers save and classes use. They end up as the "Join"
// link in the app and in emails to families, so only real https meeting links are kept —
// never javascript:/data: URLs (stored XSS in the app) or look-alike sites (phishing).

const LINK_HOSTS = { googlemeet: /(^|\.)meet\.google\.com$/i, zoom: /(^|\.)zoom\.(us|com)$/i };
const NAMES = { googlemeet: "Google Meet", zoom: "Zoom" };

/** true for an https link on that platform's domain */
export function isMeetingLink(platform, link) {
  try {
    const u = new URL(String(link).trim());
    return u.protocol === "https:" && !!LINK_HOSTS[platform]?.test(u.hostname);
  } catch { return false; }
}

/**
 * For saving: undefined stays undefined (field not sent), empty clears it, a valid link is
 * trimmed; anything else throws { statusCode: 400 } (handled as a 400 by serverError).
 */
export function cleanMeetingLink(platform, value) {
  if (value === undefined) return undefined;
  const v = String(value ?? "").trim();
  if (!v) return "";
  if (v.length > 500 || !isMeetingLink(platform, v)) {
    throw Object.assign(new Error(`Paste a valid ${NAMES[platform]} link (https://…)`), { statusCode: 400 });
  }
  return v;
}
