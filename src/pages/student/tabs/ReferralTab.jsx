// src/pages/student/tabs/ReferralTab.jsx
// Student: see their referral link, copy it, track who they've invited.

import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, Gift, Users, Star, Clock } from "lucide-react";
import api from "../../../api";

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const STATUS_META = {
  pending:  { label: "Pending",  color: "#f59e0b", bg: "#fef3c7" },
  invited:  { label: "Invited",  color: "#3b82f6", bg: "#eff6ff" },
  active:   { label: "Joined!",  color: "#16a34a", bg: "#f0fdf4" },
  rejected: { label: "Declined", color: "#94a3b8", bg: "#f1f5f9" },
};

export default function ReferralTab({ isDarkMode }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  const bg    = isDarkMode ? "#0f172a" : "#f8fafc";
  const card  = isDarkMode ? "#1e293b" : "#ffffff";
  const border= isDarkMode ? "#334155" : "#e2e8f0";
  const text  = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted = isDarkMode ? "#94a3b8" : "#64748b";

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/api/referrals/my");
      setData(res.data);
    } catch (e) {
      console.error("Referral load error:", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function copyLink() {
    if (!data?.joinUrl) return;
    navigator.clipboard.writeText(data.joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const statCards = data ? [
    { icon: Users, label: "Friends invited", value: data.stats.total,   color: "#3b82f6" },
    { icon: Check, label: "Joined",          value: data.stats.active,  color: "#16a34a" },
    { icon: Clock, label: "Pending review",  value: data.stats.pending, color: "#f59e0b" },
    { icon: Gift,  label: "Free classes won",value: data.stats.credits, color: "#8b5cf6" },
  ] : [];

  return (
    <div style={{ padding: 24, background: bg, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: text, display: "flex", alignItems: "center", gap: 8 }}>
          🎁 Invite a Friend
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: muted, lineHeight: 1.6 }}>
          Share your link — when your friend joins and activates their account, you get{" "}
          <strong style={{ color: text }}>1 free class</strong> added automatically. No limits!
        </p>
      </div>

      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading…</p>
      ) : !data ? (
        <p style={{ color: "#ef4444", fontSize: 13 }}>Could not load referral data.</p>
      ) : (
        <>
          {/* Referral link card */}
          <div style={{
            background: isDarkMode
              ? "linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)"
              : "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
            border: `1px solid ${isDarkMode ? "#334155" : "#bfdbfe"}`,
            borderRadius: 16, padding: 24, marginBottom: 20,
          }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>
              Your referral link
            </p>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: 10,
                background: isDarkMode ? "#0f172a" : "#fff",
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
              <span style={{ fontSize: 12, color: muted }}>Your code:</span>
              <span style={{
                padding: "4px 12px", borderRadius: 6,
                background: isDarkMode ? "#0f172a" : "#fff",
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
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: text }}>How it works</h3>
            {[
              { n: "1", label: "Share your link", desc: "Send it to a friend by WhatsApp, email, or any way you like." },
              { n: "2", label: "Friend applies",  desc: "They fill out a short form. Our team reviews the application." },
              { n: "3", label: "They join",        desc: "Once they set up their account, you get +1 free class instantly." },
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
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: text }}>
                People you invited ({data.referrals.length})
              </h3>
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
                      <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Applied {fmt(r.createdAt)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {r.creditAwarded && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6" }}>🎁 +1 class</span>
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
