// src/pages/sub-admin/SubAdminSetup.jsx
// This is the page sub-admin lands on after clicking the invite email link
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Shield, Lock } from "lucide-react";

export default function SubAdminSetup() {
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();
  const token            = searchParams.get("token");

  const [step, setStep]         = useState("verifying"); // verifying | form | success | error
  const [subAdminInfo, setSubAdminInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm]         = useState({ password: "", confirmPassword: "" });
  const [showPw, setShowPw]     = useState(false);
  const [showCpw, setShowCpw]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!token) {
      setErrorMsg("No invite token found. Please use the link from your invitation email.");
      setStep("error");
      return;
    }
    verifyToken();
  }, []);

  const verifyToken = async () => {
    try {
      const res = await fetch(`/api/sub-admin-auth/verify-invite/${token}`);
      const data = await res.json();
      if (data.success) {
        setSubAdminInfo(data.subAdmin);
        setStep("form");
      } else {
        setErrorMsg(data.message || "Invalid or expired invite link.");
        setStep("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStep("error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/sub-admin-auth/setup-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password, confirmPassword: form.confirmPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("success");
      } else {
        setErrorMsg(data.message || "Setup failed. Please try again.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Password strength
  const strength = (() => {
    const pw = form.password;
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const map = [
      { label: "", color: "" },
      { label: "Weak",      color: "#ef4444" },
      { label: "Fair",      color: "#f59e0b" },
      { label: "Good",      color: "#3b82f6" },
      { label: "Strong",    color: "#10b981" },
    ];
    return { score, ...map[score] };
  })();

  const rules = [
    { label: "At least 8 characters",   ok: form.password.length >= 8 },
    { label: "One uppercase letter",     ok: /[A-Z]/.test(form.password) },
    { label: "One number",               ok: /[0-9]/.test(form.password) },
    { label: "Passwords match",          ok: form.password && form.password === form.confirmPassword },
  ];

  return (
    <>
      <style>{globalCSS}</style>
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #080b14 0%, #0d1220 50%, #080b14 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", fontFamily: "'Plus Jakarta Sans', sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background orbs */}
        <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,99,210,0.08) 0%, transparent 70%)", top: "-100px", left: "-100px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(107,130,240,0.06) 0%, transparent 70%)", bottom: "-80px", right: "-80px", pointerEvents: "none" }} />

        <div style={{
          width: "100%", maxWidth: "440px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        }}>

          {/* ── VERIFYING ── */}
          {step === "verifying" && (
            <Card>
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <Loader2 size={40} color="#6b82f0" style={{ animation: "sa-spin 0.8s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>Verifying your invitation…</p>
              </div>
            </Card>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <Card>
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{
                  width: "72px", height: "72px", borderRadius: "20px",
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <XCircle size={32} color="#ef4444" />
                </div>
                <h2 style={{ color: "#e2e8f0", fontSize: "20px", fontWeight: "800", margin: "0 0 12px" }}>
                  Link Invalid
                </h2>
                <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", margin: "0 0 24px" }}>
                  {errorMsg}
                </p>
                <p style={{ color: "#475569", fontSize: "13px", margin: 0 }}>
                  Contact your administrator to request a new invitation.
                </p>
              </div>
            </Card>
          )}

          {/* ── FORM ── */}
          {step === "form" && subAdminInfo && (
            <Card>
              {/* Logo */}
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "18px",
                  background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 0 32px rgba(107,130,240,0.3)",
                }}>
                  <Shield size={28} color="white" />
                </div>
                <h1 style={{ color: "#e2e8f0", fontSize: "22px", fontWeight: "800", margin: "0 0 6px" }}>
                  Set Up Your Account
                </h1>
                <p style={{ color: "#64748b", fontSize: "13.5px", margin: 0 }}>
                  Welcome, <strong style={{ color: "#a5b4fc" }}>
                    {subAdminInfo.firstName} {subAdminInfo.lastName}
                  </strong>
                </p>
              </div>

              {/* Info banner */}
              <div style={{
                background: "rgba(79,99,210,0.08)",
                border: "1px solid rgba(107,130,240,0.2)",
                borderRadius: "12px", padding: "12px 16px",
                marginBottom: "24px",
                display: "flex", alignItems: "center", gap: "10px",
              }}>
                <Lock size={14} color="#6b82f0" style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8", lineHeight: "1.5" }}>
                  Creating account for <strong style={{ color: "#a5b4fc" }}>{subAdminInfo.email}</strong>
                </p>
              </div>

              {errorMsg && (
                <div style={{
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "12px", padding: "12px 16px", marginBottom: "20px",
                  fontSize: "13px", color: "#fca5a5",
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Password */}
                <div>
                  <label style={labelStyle}>Create Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Min. 8 characters"
                      required
                      style={inputStyle}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={eyeBtn}>
                      {showPw ? <EyeOff size={16} color="#4b5563" /> : <Eye size={16} color="#4b5563" />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {form.password && (
                    <div style={{ marginTop: "8px" }}>
                      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                        {[1,2,3,4].map((i) => (
                          <div key={i} style={{
                            flex: 1, height: "4px", borderRadius: "4px",
                            background: i <= strength.score ? strength.color : "rgba(255,255,255,0.08)",
                            transition: "background 0.3s",
                          }} />
                        ))}
                      </div>
                      <p style={{ margin: 0, fontSize: "11px", color: strength.color, fontWeight: "600" }}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showCpw ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Repeat your password"
                      required
                      style={inputStyle}
                    />
                    <button type="button" onClick={() => setShowCpw(!showCpw)} style={eyeBtn}>
                      {showCpw ? <EyeOff size={16} color="#4b5563" /> : <Eye size={16} color="#4b5563" />}
                    </button>
                  </div>
                </div>

                {/* Rules checklist */}
                {form.password && (
                  <div style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "12px", padding: "12px 14px",
                    display: "flex", flexDirection: "column", gap: "6px",
                  }}>
                    {rules.map(({ label, ok }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {ok
                          ? <CheckCircle size={13} color="#10b981" />
                          : <XCircle size={13} color="#374151" />
                        }
                        <span style={{ fontSize: "12.5px", color: ok ? "#6ee7b7" : "#4b5563" }}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || rules.some((r) => !r.ok)}
                  style={{
                    padding: "15px",
                    background: rules.every((r) => r.ok)
                      ? "linear-gradient(135deg, #4f63d2, #6b82f0)"
                      : "rgba(255,255,255,0.05)",
                    color: rules.every((r) => r.ok) ? "white" : "#374151",
                    border: "none", borderRadius: "14px",
                    fontSize: "15px", fontWeight: "700",
                    cursor: submitting || rules.some((r) => !r.ok) ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    transition: "all 0.2s",
                    boxShadow: rules.every((r) => r.ok) ? "0 4px 20px rgba(107,130,240,0.35)" : "none",
                    marginTop: "4px",
                  }}
                >
                  {submitting ? (
                    <><Loader2 size={16} style={{ animation: "sa-spin 0.8s linear infinite" }} /> Activating Account…</>
                  ) : (
                    <><CheckCircle size={16} /> Activate My Account</>
                  )}
                </button>
              </form>
            </Card>
          )}

          {/* ── SUCCESS ── */}
          {step === "success" && (
            <Card>
              <div style={{ textAlign: "center", padding: "20px" }}>
                <div style={{
                  width: "80px", height: "80px", borderRadius: "24px",
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                  boxShadow: "0 0 40px rgba(16,185,129,0.3)",
                  animation: "sa-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                }}>
                  <CheckCircle size={36} color="white" />
                </div>
                <h2 style={{ color: "#e2e8f0", fontSize: "22px", fontWeight: "800", margin: "0 0 10px" }}>
                  Account Activated! 🎉
                </h2>
                <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6", margin: "0 0 8px" }}>
                  Your account is ready. A welcome email has been sent to your inbox.
                </p>
                <p style={{ color: "#475569", fontSize: "13px", margin: "0 0 28px" }}>
                  You can now log in to your sub-admin dashboard.
                </p>
                <button
                  onClick={() => navigate("/sub-admin/login")}
                  style={{
                    width: "100%", padding: "14px",
                    background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
                    color: "white", border: "none", borderRadius: "14px",
                    fontSize: "15px", fontWeight: "700", cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 4px 20px rgba(107,130,240,0.35)",
                  }}
                >
                  Go to Login →
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "24px",
      padding: "32px 28px",
      backdropFilter: "blur(12px)",
      boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
    }}>
      {children}
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: "11.5px", fontWeight: "700",
  color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em",
  marginBottom: "8px",
};

const inputStyle = {
  width: "100%", padding: "13px 44px 13px 16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px", fontSize: "14px",
  color: "#e2e8f0", fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
};

const eyeBtn = {
  position: "absolute", right: "14px", top: "50%",
  transform: "translateY(-50%)", background: "none",
  border: "none", cursor: "pointer", padding: "2px",
  display: "flex", alignItems: "center",
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes sa-spin { to { transform: rotate(360deg); } }
  @keyframes sa-pop  { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
`;
