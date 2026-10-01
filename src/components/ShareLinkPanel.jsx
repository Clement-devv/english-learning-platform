// src/components/ShareLinkPanel.jsx
// Teacher-side panel for a managed student's share link (homework or quiz):
// copy, share (WhatsApp / Facebook / Zalo via the phone's share sheet), delete,
// and create a new link. Server side: server/utils/shareLink.js.
import { useState } from "react";
import { Link2, Copy, Share2, Trash2 } from "lucide-react";

// Center brand colour (set by utils/branding.js)
const BRAND  = "var(--brand-primary, #2563eb)";
const brandA = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;

const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const KINDS = {
  homework: { path: "hw", noun: "homework", label: "HOMEWORK LINK FOR PARENT" },
  quiz:     { path: "q",  noun: "quiz",     label: "QUIZ LINK FOR PARENT" },
};

/**
 * item: { title, dueDate, shareToken, shareLink: { expiresAt }, studentId: { firstName } }
 * kind: "homework" | "quiz"
 */
export default function ShareLinkPanel({ item, kind, isDarkMode, onCreate, onDelete, notify }) {
  const [busy, setBusy] = useState(false);
  const k = KINDS[kind];
  const url = item.shareToken ? `${window.location.origin}/${k.path}/${item.shareToken}` : null;
  const expiresAt = item.shareLink?.expiresAt;
  // Server's exact expiry when a link exists; otherwise approximate end of due day (server re-checks)
  const expired = (expiresAt ? new Date(expiresAt).getTime() : new Date(item.dueDate).getTime() + 24 * 3600 * 1000) < Date.now();
  const studentFirst = item.studentId?.firstName || "your child";
  const Noun = k.noun[0].toUpperCase() + k.noun.slice(1);

  const shareText = url
    ? `${Noun} for ${studentFirst}: "${item.title}"\nDue ${fmtDate(item.dueDate)}\n\nOpen it here: ${url}\n\nType the student's name and the teacher's name to open it.`
    : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); notify("Link copied — paste it into WhatsApp, Facebook or Zalo"); }
    catch { notify("Could not copy — select the link and copy it manually", "error"); }
  };
  const openWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: item.title, text: shareText }); } catch { /* user cancelled */ }
    } else {
      openWhatsApp();
    }
  };
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const muted = isDarkMode ? "#94a3b8" : "#64748b";
  const btn = (bg, color) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
    border: "none", background: bg, color, fontSize: 12, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.7 : 1, fontFamily: "inherit",
  });

  return (
    <div style={{
      background: isDarkMode ? brandA(0.1) : brandA(0.06),
      border: `1px solid ${isDarkMode ? brandA(0.4) : brandA(0.3)}`, borderRadius: 12, padding: 14,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: BRAND, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Link2 size={13} /> {k.label}
      </div>

      {url && !expired ? (
        <>
          <input readOnly value={url} onFocus={e => e.target.select()} aria-label={`${Noun} link`}
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${brandA(0.3)}`, fontSize: 12, fontFamily: "monospace", background: isDarkMode ? "#0f172a" : "#fff", color: isDarkMode ? "#e2e8f0" : "#1e293b", marginBottom: 10 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={copy} style={btn(BRAND, "#fff")}><Copy size={13} /> Copy link</button>
            <button type="button" onClick={share} style={btn("#16a34a", "#fff")}><Share2 size={13} /> Share</button>
            {navigator.share && (
              <button type="button" onClick={openWhatsApp} style={btn(isDarkMode ? "#1e293b" : "#fff", "#16a34a")}>WhatsApp</button>
            )}
            <button type="button" disabled={busy}
              onClick={() => { if (window.confirm(`Delete this link? Anyone who has it will no longer be able to open the ${k.noun}. You can create a new link afterwards.`)) run(onDelete); }}
              style={btn(isDarkMode ? "#1e293b" : "#fff", "#dc2626")}>
              <Trash2 size={13} /> Delete link
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: BRAND }}>
            Works until the end of {fmtDate(item.dueDate)}. The student must type their name and your name to open it.
          </p>
        </>
      ) : expired ? (
        <p style={{ margin: 0, fontSize: 12, color: muted }}>The link expired on {fmtDate(item.dueDate)} (due date passed).</p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: muted }}>No active link — the old one was deleted.</span>
          <button type="button" disabled={busy} onClick={() => run(onCreate)} style={btn(BRAND, "#fff")}>
            <Link2 size={13} /> Create new link
          </button>
        </div>
      )}
    </div>
  );
}
