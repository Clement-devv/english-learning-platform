// server/emails/layout.js
// The one Sunshine email layout every email is built from: center logo + name, a warm
// card, one orange button, a plain footer.
//
// Email HTML is not web HTML. Rules followed here (so it holds up in Gmail, Outlook,
// Apple Mail, Yahoo and phone apps):
//   • layout with <table>s, every style inline — Gmail drops <style> in some views,
//     Outlook (Word engine) ignores most modern CSS
//   • no flexbox / grid / CSS variables; gradients only on top of a solid bgcolor
//   • the button is a padded table cell with a link inside — clickable everywhere,
//     including Outlook, without VML
//   • 600px max, fluid below that, so phones get a full-width card
//   • light colour scheme declared so dark-mode apps don't invert the brand colours
//     into mud; colours chosen to stay readable if an app inverts anyway
//   • a hidden preheader = the grey preview line next to the subject in the inbox

export const C = {
  page:    "#fbf3ec",   // warm cream behind the card
  card:    "#ffffff",
  line:    "#f1e4d8",
  ink:     "#2b1d14",
  body:    "#4a3a2f",
  muted:   "#8a7262",
  accent:  "#ea580c",   // orange — buttons, links
  accentSoft: "#fff1e6",
  pink:    "#ec4899",
};

const TONES = {
  accent: { bar: C.accent, soft: "#fff4ea", edge: "#fbd5b5", ink: "#9a3412" },
  green:  { bar: "#16a34a", soft: "#effaf2", edge: "#bfe8cb", ink: "#166534" },
  amber:  { bar: "#d97706", soft: "#fff8e6", edge: "#f6dfa6", ink: "#92400e" },
  red:    { bar: "#dc2626", soft: "#fef2f2", edge: "#fbcaca", ink: "#991b1b" },
  blue:   { bar: "#2563eb", soft: "#eff5ff", edge: "#c8dafc", ink: "#1e40af" },
};

const FONT = "'Nunito','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Absolute logo URL (uploaded logos are stored as "/uploads/…") */
const logoUrl = (center, baseUrl) => {
  const l = center?.branding?.logo || center?.logo;
  if (!l) return null;
  if (/^https?:\/\//.test(l)) return l;
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/${l.replace(/^\//, "")}` : null;
};

// ── building blocks (all return HTML strings) ───────────────────────────────────

/** Plain paragraph. `html` is trusted markup — escape user values before passing. */
export const p = (html, { size = 15, color = C.body, mt = 0, mb = 14, align = "left" } = {}) =>
  `<p style="margin:${mt}px 0 ${mb}px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};text-align:${align};">${html}</p>`;

/** Label / value rows inside a soft panel — class details, amounts… */
export const details = (rows) => {
  const list = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && r[1] !== "");
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;background:${C.accentSoft};border:1px solid ${C.line};border-radius:14px;">
    <tr><td style="padding:6px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${list.map(([label, value], i) => `
        <tr>
          <td valign="top" style="padding:11px 12px 11px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:13px;font-weight:700;color:${C.muted};white-space:nowrap;width:38%;">${esc(label)}</td>
          <td valign="top" style="padding:11px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:15px;font-weight:700;color:${C.ink};">${value}</td>
        </tr>`).join("")}
      </table>
    </td></tr>
  </table>`;
};

/** Highlighted note with a coloured left edge — reminders, warnings, tips. */
export const callout = (html, tone = "amber") => {
  const t = TONES[tone] || TONES.amber;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
    <tr>
      <td width="4" style="background:${t.bar};border-radius:4px 0 0 4px;font-size:0;line-height:0;">&nbsp;</td>
      <td style="background:${t.soft};border:1px solid ${t.edge};border-left:0;border-radius:0 12px 12px 0;padding:13px 16px;font-family:${FONT};font-size:14px;line-height:1.55;color:${t.ink};">${html}</td>
    </tr>
  </table>`;
};

/** Bulleted list */
export const list = (items, { color = C.body } = {}) =>
  `<ul style="margin:0 0 16px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.7;color:${color};">${items.map((i) => `<li style="margin:0 0 4px;">${i}</li>`).join("")}</ul>`;

/** Big centred code (verification / 2FA codes) */
export const code = (value) => `
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:6px auto 20px;">
    <tr><td style="background:${C.accentSoft};border:1px dashed #f5b98a;border-radius:14px;padding:14px 26px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:${C.ink};">${esc(value)}</td></tr>
  </table>`;

/** Bulletproof button: a padded, rounded table cell; the whole cell is the link. */
export const button = (label, href, tone = "accent") => {
  const bg = (TONES[tone] || TONES.accent).bar;
  return `
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 6px;">
    <tr><td align="center" bgcolor="${bg}" style="border-radius:14px;background:${bg};">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px;">${esc(label)}&nbsp;&rarr;</a>
    </td></tr>
  </table>`;
};

// ── the page ────────────────────────────────────────────────────────────────────

/**
 * @param {object}  o
 * @param {object}  o.center     center doc (name, branding.logo) — or null
 * @param {string}  o.centerName fallback name
 * @param {string}  o.baseUrl    center site, for the logo + footer link
 * @param {string}  o.preheader  inbox preview line
 * @param {string}  o.eyebrow    small coloured line above the title ("Class confirmed")
 * @param {string}  o.title      headline
 * @param {string}  o.body       inner HTML built from the blocks above
 * @param {{label,href,tone?}} [o.cta] main button
 * @param {string}  [o.after]    small text under the button
 * @param {string}  [o.extra]    raw HTML after that (e.g. a link fallback)
 * @param {string}  [o.tone]     colour of the top bar + eyebrow
 * @param {string}  [o.footer]   extra footer line
 * @param {string}  [o.lang]     "en" | "vi"
 */
export const renderEmail = ({ center, centerName, baseUrl, preheader = "", eyebrow = "", title, body, cta, after = "", extra = "", tone = "accent", footer = "", lang = "en" }) => {
  const t = TONES[tone] || TONES.accent;
  const rawName = center?.centerName || center?.name || centerName || "Your school";
  const name = esc(rawName);
  const logo = logoUrl(center, baseUrl);
  const initial = esc(rawName.trim()[0]?.toUpperCase() || "S");
  const auto = lang === "vi" ? "Đây là email tự động, vui lòng không trả lời." : "This is an automated message — please don't reply.";
  const sentBy = lang === "vi" ? `Gửi từ ${name}` : `Sent by ${name}`;

  return `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .em-shell { padding: 14px 10px !important; }
    .em-card-pad { padding: 26px 20px 24px !important; }
    .em-title { font-size: 23px !important; }
  }
  a { color: ${C.accent}; }
</style>
</head>
<body data-em-layout="sunshine" style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${esc(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
    <tr><td align="center" class="em-shell" style="padding:28px 16px;">
      <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">

        <!-- brand -->
        <tr><td style="padding:0 6px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:12px;">
              ${logo
                ? `<img src="${esc(logo)}" width="44" height="44" alt="${name}" style="display:block;width:44px;height:44px;border-radius:12px;object-fit:cover;border:0;">`
                : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="44" height="44" align="center" valign="middle" bgcolor="${C.accent}" style="width:44px;height:44px;border-radius:12px;background:${C.accent};background-image:linear-gradient(135deg,${C.accent},${C.pink});font-family:${FONT};font-size:20px;font-weight:900;color:#ffffff;">${initial}</td></tr></table>`}
            </td>
            <td valign="middle" style="font-family:${FONT};font-size:17px;font-weight:800;color:${C.ink};">${name}</td>
          </tr></table>
        </td></tr>

        <!-- card -->
        <tr><td bgcolor="${C.card}" style="background:${C.card};border:2px solid ${t.edge};border-radius:24px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="em-card-pad" style="padding:34px 36px 30px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body};">
              ${eyebrow ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${t.ink};">${esc(eyebrow)}</p>` : ""}
              <h1 class="em-title" style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:900;color:${C.ink};">${esc(title)}</h1>
              ${body}
              ${cta ? button(cta.label, cta.href, cta.tone) : ""}
              ${after ? p(after, { size: 13, color: C.muted, mt: 16, mb: 0, align: "center" }) : ""}
              ${extra}
            </td></tr>
          </table>
        </td></tr>

        <!-- footer -->
        <tr><td align="center" style="padding:20px 20px 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">
          ${footer ? `${footer}<br>` : ""}${sentBy}${baseUrl ? ` · <a href="${esc(baseUrl)}" style="color:${C.muted};text-decoration:underline;">${esc(baseUrl.replace(/^https?:\/\//, ""))}</a>` : ""}<br>${auto}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/**
 * Wrap an existing, simple HTML body (plain <p>, <ul> …) in the Sunshine layout.
 * For the short one-off emails built inside route files. The body inherits the
 * layout font and colours, so plain tags look right without extra styling.
 */
export const wrapHtml = ({ title, html, centerName, center = null, baseUrl = null, eyebrow = "", preheader = "", tone = "accent", cta }) =>
  renderEmail({ center, centerName, baseUrl, title, eyebrow, preheader, tone, cta, body: html });
