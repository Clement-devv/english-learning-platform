// src/pages/sub-admin/SubAdminLogin.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Shield, ArrowRight, Loader2 } from "lucide-react";

export default function SubAdminLogin() {
  const navigate    = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState("");

  useEffect(() => {
    setMounted(true);
    // If already logged in, redirect
    if (localStorage.getItem("subAdminToken")) {
      navigate("/sub-admin/dashboard");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sub-admin-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("subAdminToken", data.token);
        localStorage.setItem("subAdminInfo", JSON.stringify(data.subAdmin));
        navigate("/sub-admin/dashboard");
      } else {
        setError(data.message || "Login failed. Please check your credentials.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #080b14 0%, #0d1220 60%, #080b14 100%)",
        display: "flex", fontFamily: "'Plus Jakarta Sans', sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        {/* BG orbs */}
        <div style={{ position: "absolute", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,99,210,0.07) 0%, transparent 65%)", top: "-150px", left: "-150px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 65%)", bottom: "-100px", right: "-100px", pointerEvents: "none" }} />

        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(107,130,240,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(107,130,240,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        {/* ── Left branding panel ── */}
        <div style={{
          width: "42%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "60px 48px",
          borderRight: "1px solid rgba(255,255,255,0.04)",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateX(0)" : "translateX(-20px)",
          transition: "all 0.6s ease",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "60px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "14px",
              background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 24px rgba(107,130,240,0.35)",
            }}>
              <Shield size={20} color="white" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#e2e8f0" }}>EduLearn</p>
              <p style={{ margin: 0, fontSize: "10px", color: "#374151", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>Sub-Admin Portal</p>
            </div>
          </div>

          <h1 style={{
            fontSize: "36px", fontWeight: "800", color: "#e2e8f0",
            lineHeight: "1.2", margin: "0 0 16px", letterSpacing: "-0.5px",
          }}>
            Manage Your<br />
            <span style={{ background: "linear-gradient(135deg, #6b82f0, #a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Assigned Team
            </span>
          </h1>

          <p style={{ fontSize: "14.5px", color: "#374151", lineHeight: "1.7", margin: "0 0 48px", maxWidth: "340px" }}>
            Access your scoped dashboard to view and manage the teachers and students assigned to you by the main administrator.
          </p>

          {/* Feature list */}
          {[
            { icon: "👨‍🏫", text: "View assigned teachers & their schedules" },
            { icon: "👩‍🎓", text: "Track student progress and bookings" },
            { icon: "💬", text: "Message teachers and students directly" },
            { icon: "📋", text: "Monitor class completions" },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <span style={{ fontSize: "18px" }}>{icon}</span>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#4b5563", fontWeight: "500" }}>{text}</p>
            </div>
          ))}
        </div>

        {/* ── Right login form ── */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 48px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s ease 0.1s",
        }}>
          <div style={{ width: "100%", maxWidth: "400px" }}>

            <div style={{ marginBottom: "36px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#374151", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Sub-Admin Access
              </p>
              <h2 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#e2e8f0", letterSpacing: "-0.3px" }}>
                Sign In
              </h2>
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "12px", padding: "12px 16px", marginBottom: "20px",
                fontSize: "13.5px", color: "#fca5a5",
              }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Email */}
              <div>
                <label style={labelSt}>Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused("")}
                  placeholder="you@company.com"
                  required
                  style={{
                    ...inputSt,
                    border: `1px solid ${focused === "email" ? "rgba(107,130,240,0.5)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: focused === "email" ? "0 0 0 3px rgba(107,130,240,0.08)" : "none",
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={labelSt}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused("")}
                    placeholder="Your password"
                    required
                    style={{
                      ...inputSt,
                      paddingRight: "44px",
                      border: `1px solid ${focused === "password" ? "rgba(107,130,240,0.5)" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: focused === "password" ? "0 0 0 3px rgba(107,130,240,0.08)" : "none",
                    }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{
                    position: "absolute", right: "14px", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", padding: 0,
                    display: "flex", alignItems: "center",
                  }}>
                    {showPw ? <EyeOff size={16} color="#374151" /> : <Eye size={16} color="#374151" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "14px",
                  background: loading ? "rgba(107,130,240,0.4)" : "linear-gradient(135deg, #4f63d2, #6b82f0)",
                  color: "white", border: "none", borderRadius: "14px",
                  fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  marginTop: "8px",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(107,130,240,0.35)",
                  transition: "all 0.2s",
                }}
              >
                {loading ? (
                  <><Loader2 size={17} style={{ animation: "sa-spin 0.8s linear infinite" }} /> Signing In…</>
                ) : (
                  <>Sign In <ArrowRight size={17} /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ margin: "28px 0", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
              <p style={{ margin: 0, fontSize: "12px", color: "#1f2937" }}>Other portals</p>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
            </div>

            {/* Portal links */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: "Main Admin Portal", path: "/admin/login" },
                { label: "Teacher Portal",    path: "/teacher/login" },
                { label: "Student Portal",    path: "/student/login" },
              ].map(({ label, path }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  style={{
                    padding: "10px 16px", borderRadius: "10px",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.05)",
                    color: "#374151", fontFamily: "inherit",
                    fontSize: "13px", fontWeight: "600", cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  className="sa-portal-btn"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const labelSt = {
  display: "block", fontSize: "11.5px", fontWeight: "700",
  color: "#374151", textTransform: "uppercase",
  letterSpacing: "0.08em", marginBottom: "8px",
};

const inputSt = {
  width: "100%", padding: "13px 16px",
  background: "rgba(255,255,255,0.03)",
  borderRadius: "12px", fontSize: "14px",
  color: "#e2e8f0", fontFamily: "inherit", outline: "none",
  boxSizing: "border-box", transition: "border 0.15s, box-shadow 0.15s",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  @keyframes sa-spin { to { transform: rotate(360deg); } }
  .sa-portal-btn:hover { background: rgba(255,255,255,0.04) !important; color: #9ca3af !important; }
`;
