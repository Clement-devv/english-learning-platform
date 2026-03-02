// src/pages/student/StudentSetup.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api";

export default function StudentSetup() {
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();
  const token            = searchParams.get("token");

  const [step,      setStep]      = useState("loading"); // loading | form | success | error
  const [student,   setStudent]   = useState(null);
  const [errorMsg,  setErrorMsg]  = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [submitting,setSubmitting]= useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);

  // ── Password strength checks ──────────────────────────────────────────────
  const checks = {
    length:   password.length >= 8,
    upper:    /[A-Z]/.test(password),
    lower:    /[a-z]/.test(password),
    number:   /[0-9]/.test(password),
    match:    password && password === confirm,
  };
  const strength = Object.values(checks).filter(Boolean).length;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Perfect"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#10b981"][strength];

  // ── Verify token on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStep("error"); setErrorMsg("No invite token found in the URL."); return; }
    (async () => {
      try {
        const res = await api.get(`/api/students/verify-invite/${token}`);
        setStudent(res.data.student);
        setStep("form");
      } catch (err) {
        setStep("error");
        setErrorMsg(err.response?.data?.message || "Invalid or expired invite link.");
      }
    })();
  }, [token]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!checks.length) return;
    if (!checks.match)  return;

    setSubmitting(true);
    try {
      await api.post("/api/students/setup-account", { token, password });
      setStep("success");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Something went wrong. Please try again.");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  };

  const c = {
    bg:     "#f0f4ff",
    card:   "#ffffff",
    border: "#e2e8f0",
    head:   "#1e293b",
    muted:  "#64748b",
    accent: "#3b82f6",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${c.bg}; font-family: 'Plus Jakarta Sans', sans-serif; }
        .ss-input { width:100%; padding:11px 14px; border-radius:10px; border:1.5px solid ${c.border}; font-family:inherit; font-size:14px; color:${c.head}; outline:none; transition:border 0.15s; }
        .ss-input:focus { border-color:${c.accent}; box-shadow:0 0 0 3px rgba(59,130,246,0.12); }
        .ss-btn { width:100%; padding:13px; border-radius:12px; border:none; background:linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; font-family:inherit; font-size:15px; font-weight:800; cursor:pointer; transition:opacity 0.15s; }
        .ss-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .ss-check { display:flex; align-items:center; gap:8px; font-size:13px; margin:4px 0; }
        .ss-check .dot { width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:9px; flex-shrink:0; font-weight:800; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .ss-card { animation: fadeIn 0.35s ease; }
      `}</style>

      <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#dbeafe 0%,#ede9fe 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
        <div className="ss-card" style={{ width:"100%", maxWidth:"460px", background:c.card, borderRadius:"24px", boxShadow:"0 20px 60px rgba(59,130,246,0.15)", overflow:"hidden" }}>

          {/* ── LOADING ── */}
          {step === "loading" && (
            <div style={{ padding:"60px 40px", textAlign:"center" }}>
              <div style={{ width:"48px", height:"48px", borderRadius:"50%", border:"4px solid #dbeafe", borderTopColor:"#3b82f6", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
              <p style={{ color:c.muted, fontSize:"14px" }}>Verifying your invite link…</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* ── FORM ── */}
          {step === "form" && student && (
            <>
              {/* Header */}
              <div style={{ background:"linear-gradient(135deg,#3b82f6,#6366f1)", padding:"36px 40px", textAlign:"center" }}>
                <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px", margin:"0 auto 12px" }}>🎓</div>
                <h1 style={{ color:"#fff", fontSize:"22px", fontWeight:"800", marginBottom:"6px" }}>Welcome, {student.firstName}!</h1>
                <p style={{ color:"rgba(255,255,255,0.8)", fontSize:"13.5px" }}>Set your password to activate your account</p>
              </div>

              {/* Body */}
              <div style={{ padding:"32px 40px" }}>
                {/* Student info pill */}
                <div style={{ background:"#f0f7ff", border:"1px solid #bfdbfe", borderRadius:"12px", padding:"14px 18px", marginBottom:"24px", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"8px" }}>
                  <div style={{ fontSize:"13px" }}>
                    <span style={{ color:c.muted }}>Email: </span>
                    <span style={{ fontWeight:"700", color:c.head }}>{student.email}</span>
                  </div>
                  <div style={{ fontSize:"13px" }}>
                    <span style={{ color:c.muted }}>Classes: </span>
                    <span style={{ fontWeight:"700", color:"#3b82f6" }}>{student.noOfClasses}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Password field */}
                  <div style={{ marginBottom:"16px" }}>
                    <label style={{ display:"block", fontSize:"13px", fontWeight:"700", color:c.head, marginBottom:"6px" }}>New Password</label>
                    <div style={{ position:"relative" }}>
                      <input
                        className="ss-input"
                        type={showPass ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:c.muted, fontSize:"16px" }}>
                        {showPass ? "🙈" : "👁️"}
                      </button>
                    </div>

                    {/* Strength bar */}
                    {password && (
                      <div style={{ marginTop:"10px" }}>
                        <div style={{ height:"4px", borderRadius:"4px", background:"#e2e8f0", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${(strength/5)*100}%`, background:strengthColor, borderRadius:"4px", transition:"all 0.3s" }} />
                        </div>
                        <p style={{ fontSize:"11px", fontWeight:"700", color:strengthColor, marginTop:"4px" }}>{strengthLabel}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm field */}
                  <div style={{ marginBottom:"20px" }}>
                    <label style={{ display:"block", fontSize:"13px", fontWeight:"700", color:c.head, marginBottom:"6px" }}>Confirm Password</label>
                    <div style={{ position:"relative" }}>
                      <input
                        className="ss-input"
                        type={showConf ? "text" : "password"}
                        placeholder="Repeat your password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setShowConf(!showConf)}
                        style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:c.muted, fontSize:"16px" }}>
                        {showConf ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  {/* Checklist */}
                  {password && (
                    <div style={{ background:"#f8fafc", border:`1px solid ${c.border}`, borderRadius:"12px", padding:"14px 18px", marginBottom:"20px" }}>
                      {[
                        { key:"length", label:"At least 8 characters" },
                        { key:"upper",  label:"One uppercase letter" },
                        { key:"lower",  label:"One lowercase letter" },
                        { key:"number", label:"One number" },
                        { key:"match",  label:"Passwords match" },
                      ].map(({ key, label }) => (
                        <div key={key} className="ss-check">
                          <div className="dot" style={{ background: checks[key] ? "#22c55e" : "#e2e8f0", color: checks[key] ? "#fff" : "#94a3b8" }}>
                            {checks[key] ? "✓" : "·"}
                          </div>
                          <span style={{ color: checks[key] ? "#15803d" : c.muted }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="ss-btn" type="submit"
                    disabled={submitting || !checks.length || !checks.match}>
                    {submitting ? "Activating account…" : "Activate My Account 🚀"}
                  </button>
                </form>
              </div>
            </>
          )}

          {/* ── SUCCESS ── */}
          {step === "success" && (
            <div style={{ padding:"60px 40px", textAlign:"center" }}>
              <div style={{ fontSize:"64px", marginBottom:"16px" }}>🎉</div>
              <h2 style={{ fontSize:"22px", fontWeight:"800", color:c.head, marginBottom:"10px" }}>Account Activated!</h2>
              <p style={{ color:c.muted, fontSize:"14px", lineHeight:"1.7", marginBottom:"28px" }}>
                Your account is all set. You can now log in and join your English classes!
              </p>
              <button className="ss-btn" onClick={() => navigate("/student/login")} style={{ width:"auto", padding:"13px 36px" }}>
                Go to Login →
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <div style={{ padding:"60px 40px", textAlign:"center" }}>
              <div style={{ fontSize:"56px", marginBottom:"16px" }}>😕</div>
              <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#ef4444", marginBottom:"10px" }}>Link Invalid or Expired</h2>
              <p style={{ color:c.muted, fontSize:"14px", lineHeight:"1.7", marginBottom:"28px" }}>
                {errorMsg || "This invite link has expired or already been used. Please ask your admin to resend the invitation."}
              </p>
              <button className="ss-btn" onClick={() => navigate("/student/login")} style={{ width:"auto", padding:"13px 36px", background:"linear-gradient(135deg,#64748b,#475569)" }}>
                Back to Login
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
