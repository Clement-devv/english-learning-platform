// src/pages/student/tabs/ReferralTab.jsx
// Student: see their referral link, copy it, track who they've invited.

import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, Gift, Users, Star, Clock } from "lucide-react";
import api from "../../../api";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/i18n.js";
import { dateLocale } from "../../../i18n/dateLocale.js";

// For text in file-level lists: read when rendered, so it follows the chosen language
const ta = (key, opts) => i18n.t(`student:${key}`, opts);


const fmt = (d) =>
  d ? new Date(d).toLocaleDateString(dateLocale("en-US"), { month: "short", day: "numeric", year: "numeric" }) : "—";

const STATUS_META = {
  pending:  { get label() { return ta("referralTab.statusMetaPending"); },  color: "#f59e0b", bg: "#fef3c7" },
  invited:  { get label() { return ta("referralTab.statusMetaInvited"); },  color: "#3b82f6", bg: "#eff6ff" },
  active:   { get label() { return ta("referralTab.statusMetaJoined"); },  color: "#16a34a", bg: "#f0fdf4" },
  rejected: { get label() { return ta("referralTab.statusMetaDeclined"); }, color: "var(--as-muted, #94a3b8)", bg: "var(--as-raised, #f1f5f9)" },
};

export default function ReferralTab({ isDarkMode }) {
  const { t: tr } = useTranslation("student");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  const bg    = isDarkMode ? "var(--as-surface, #0f172a)" : "var(--as-raised, #f8fafc)";
  const card  = isDarkMode ? "var(--as-raised, #1e293b)" : "var(--as-surface, #ffffff)";
  const border= isDarkMode ? "var(--as-line, #334155)" : "var(--as-line, #e2e8f0)";
  const text  = isDarkMode ? "var(--as-ink, #e2e8f0)" : "var(--as-ink, #1e293b)";
  const muted = isDarkMode ? "var(--as-muted, #94a3b8)" : "var(--as-ink-2, #64748b)";

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/referrals/my");
      setData(res.data);
    } catch (e) {
      console.error("Referral load error:", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);  

  function copyLink() {
    if (!data?.joinUrl) return;
    navigator.clipboard.writeText(data.joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const statCards = data ? [
    { icon: Users, label: tr("referralTab.friendsInvited"), value: data.stats.total,   color: "#3b82f6" },
    { icon: Check, label: tr("referralTab.joined2"),          value: data.stats.active,  color: "#16a34a" },
    { icon: Clock, label: tr("referralTab.pendingReview"),  value: data.stats.pending, color: "#f59e0b" },
    { icon: Gift,  label: tr("referralTab.freeClassesWon"),value: data.stats.credits, color: "var(--as-accent-ink, #8b5cf6)" },
  ] : [];

  return (
    <div style={{ padding: 24, background: bg, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: text, display: "flex", alignItems: "center", gap: 8 }}>
          {tr("referralTab.inviteAFriend")}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: muted, lineHeight: 1.6 }}>
          {tr("referralTab.shareYourLinkWhenYour")}{" "}
          <strong style={{ color: text }}>{tr("referralTab.t1FreeClass")}</strong> {tr("referralTab.addedAutomaticallyNoLimits")}
        </p>
      </div>

      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>{tr("referralTab.loading")}</p>
      ) : !data ? (
        <p style={{ color: "#ef4444", fontSize: 13 }}>{tr("referralTab.couldNotLoadReferralData")}</p>
      ) : (
        <>
          {/* Referral link card */}
          <div style={{
            background: isDarkMode
              ? "linear-gradient(135deg, #1e3a5f 0%, var(--as-raised, #1e293b) 100%)"
              : "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
            border: `1px solid ${isDarkMode ? "var(--as-line, #334155)" : "#bfdbfe"}`,
            borderRadius: 16, padding: 24, marginBottom: 20,
          }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>
              {tr("referralTab.yourReferralLink")}
            </p>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: 10,
                background: isDarkMode ? "var(--as-surface, #0f172a)" : "var(--as-surface, #fff)",
                border: `1px solid ${border}`,
                fontSize: 13, color: text, fontFamily: "monospace",
                wordBreak: "break-all", minWidth: 0,
              }}>
                {data.joinUrl}
              </div>
              <button
                onClick={copyLink}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 18px", borderRadius: 10, border: "none",
                  background: copied ? "#16a34a" : "#3b82f6",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}
              >
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy link</>}
              </button>
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: muted }}>{tr("referralTab.yourCode")}</span>
              <span style={{
                padding: "4px 12px", borderRadius: 6,
                background: isDarkMode ? "var(--as-surface, #0f172a)" : "var(--as-surface, #fff)",
                border: `1px solid ${border}`,
                fontFamily: "monospace", fontSize: 15, fontWeight: 800,
                color: "#3b82f6", letterSpacing: 3,
              }}>
                {data.code}
              </span>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
            {statCards.map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{
                background: card, border: `1px solid ${border}`,
                borderRadius: 12, padding: "16px 14px", textAlign: "center",
              }}>
                <Icon size={22} style={{ color, marginBottom: 8 }} />
                <div style={{ fontSize: 26, fontWeight: 900, color: text, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div style={{
            background: card, border: `1px solid ${border}`, borderRadius: 14,
            padding: 20, marginBottom: 24,
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: text }}>{tr("referralTab.howItWorks")}</h3>
            {[
              { n: "1", label: tr("referralTab.shareYourLink"), desc: tr("referralTab.sendItToAFriend") },
              { n: "2", label: tr("referralTab.friendApplies"),  desc: tr("referralTab.theyFillOutAShort") },
              { n: "3", label: tr("referralTab.theyJoin"),        desc: tr("referralTab.onceTheySetUpTheir") },
            ].map(step => (
              <div key={step.n} style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", background: "#3b82f6",
                  color: "#fff", fontWeight: 900, fontSize: 14, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {step.n}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text }}>{step.label}</div>
                  <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Referral list */}
          {data.referrals.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: text }}>{tr("referralTab.peopleYouInvited", { referralsCount: data.referrals.length })}</h3>
              {data.referrals.map(r => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                return (
                  <div key={r._id} style={{
                    background: card, border: `1px solid ${border}`,
                    borderRadius: 11, padding: "12px 16px", marginBottom: 8,
                    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: text }}>
                        {r.referredFirstName} {r.referredLastName}
                      </span>
                      <span style={{ fontSize: 12, color: muted, marginLeft: 8 }}>{r.referredEmail}</span>
                      <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{tr("referralTab.applied", { fmt: fmt(r.createdAt) })}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {r.creditAwarded && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--as-accent-ink, #8b5cf6)" }}>{tr("referralTab.t1Class")}</span>
                      )}
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: meta.bg, color: meta.color,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
