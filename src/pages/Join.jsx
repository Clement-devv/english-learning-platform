// src/pages/Join.jsx
// Public page — linked from a student's referral URL: /join?ref=CODE
// Applicant fills name + email → sent to admin for approval.

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Join() {
  const [params]      = useSearchParams();
  const refCode       = params.get("ref") || "";

  const [form,     setForm]     = useState({ firstName: "", lastName: "", email: "", referralCode: refCode });
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState("");
  const [codeErr,  setCodeErr]  = useState(!refCode);

  useEffect(() => {
    setForm(f => ({ ...f, referralCode: refCode }));
    setCodeErr(!refCode);
  }, [refCode]);

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await fetch(`${API}/api/referrals/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Something went wrong"); return; }
      setDone(true);
    } catch (err) {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1.5px solid #d1d5db", fontSize: 15,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)",
      padding: "24px 16px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 36px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.10)", width: "100%", maxWidth: 440,
      }}>
        {/* Logo / branding */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎓</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#1e293b" }}>
            You're invited!
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>
            A friend thought you'd love learning English with us.
            Fill in your details and we'll be in touch!
          </p>
        </div>

        {done ? (
          <div style={{
            textAlign: "center", padding: "24px 0",
          }}>
            <div style={{ fontSize: 50, marginBottom: 12 }}>🎉</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#16a34a" }}>
              Application received!
            </h2>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              We'll review your request and send an invite to <strong>{form.email}</strong> shortly.
              Check your inbox!
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {codeErr && !form.referralCode && (
              <div style={{
                padding: "10px 14px", borderRadius: 8,
                background: "#fef3c7", border: "1px solid #f59e0b",
                fontSize: 13, color: "#92400e",
              }}>
                ⚠️ No referral code in the link. Please enter one below.
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                  First name
                </label>
                <input
                  required
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Your first name"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                  Last name
                </label>
                <input
                  required
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Your last name"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                Email address
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
                Referral code
              </label>
              <input
                required
                value={form.referralCode}
                onChange={e => setForm(f => ({ ...f, referralCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. A3F72B1C"
                style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 2 }}
                maxLength={8}
              />
            </div>

            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 8,
                background: "#fef2f2", border: "1px solid #fca5a5",
                fontSize: 13, color: "#dc2626",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 6, padding: "14px", borderRadius: 12, border: "none",
                background: busy ? "#86efac" : "#16a34a",
                color: "#fff", fontSize: 16, fontWeight: 800,
                cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit", transition: "background 0.2s",
              }}
            >
              {busy ? "Submitting…" : "Request my invite →"}
            </button>

            <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
              We'll review your application and send an invite link to your email.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
