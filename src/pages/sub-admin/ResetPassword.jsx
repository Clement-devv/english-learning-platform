// src/pages/sub-admin/ResetPassword.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle, Loader2, Shield } from "lucide-react";
import { useBranding } from "../../context/BrandingContext";
import api from "../../api";

export default function SubAdminResetPassword() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const centerSlug = searchParams.get("center") || import.meta.env.VITE_CENTER_SLUG || "";

  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]               = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [success, setSuccess]             = useState(false);
  const [mounted, setMounted]             = useState(false);
  const [focused, setFocused]             = useState("");

  const { branding, center } = useBranding();
  const centerName = center?.centerName || "English Learning Platform";

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post(
        `/sub-admin-auth/reset-password/${token}`,
        { password, confirmPassword },
        { headers: centerSlug ? { "x-center-slug": centerSlug } : {} }
      );
      setSuccess(true);
      setTimeout(() => navigate("/sub-admin/login"), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const bgStyle = {
    minHeight: "100vh",
    background: branding.loginBackground
      ? `url(${branding.loginBackground}) center/cover no-repeat`
      : "linear-gradient(135deg, #080b14 0%, #0d1220 60%, #080b14 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: branding.fontFamily ? `'${branding.fontFamily}', sans-serif` : "var(--font-body)",
    position: "relative", overflow: "hidden",
  };

  if (success) {
    return (
      <>
        <style>{css}</style>
        <div style={bgStyle}>
          {branding.loginBackground && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${Math.max(branding.loginBgOverlay ?? 0.45, 0.55)})`, pointerEvents: "none" }} />}
          <Orbs />
          <div style={{
            position: "relative", zIndex: 1,
            width: "100%", maxWidth: "420px", padding: "0 20px",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.5s ease",
            textAlign: "center",
          }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "20px", padding: "48px 40px",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "50%",
                background: "rgba(16,185,129,0.12)",
                border: "1.5px solid rgba(16,185,129,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <CheckCircle size={28} color="#10b981" />
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: "22px", fontWeight: "800", color: "#e2e8f0" }}>Password Reset!</h2>
              <p style={{ margin: "0 0 24px", fontSize: "13.5px", color: "#374151", lineHeight: "1.7" }}>
                Your password has been updated. You can now log in with your new password.
              </p>
              <p style={{ margin: "0 0 24px", fontSize: "12.5px", color: "#252840" }}>Redirecting to login…</p>
              <button
                onClick={() => navigate("/sub-admin/login")}
                style={{
                  width: "100%", padding: "13px",
                  background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
                  color: "white", border: "none", borderRadius: "12px",
                  fontSize: "14px", fontWeight: "700", cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 4px 16px rgba(107,130,240,0.35)",
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div style={bgStyle}>
        {branding.loginBackground && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${Math.max(branding.loginBgOverlay ?? 0.45, 0.55)})`, pointerEvents: "none" }} />}
        <Orbs />

        <div style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: "420px", padding: "0 20px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s ease",
        }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px", justifyContent: "center" }}>
            {branding.logo ? (
              <img src={branding.logo} alt={centerName} style={{ height: 36, maxWidth: 130, objectFit: "contain" }} />
            ) : (
              <div style={{
                width: "38px", height: "38px", borderRadius: "12px",
                background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Shield size={18} color="white" />
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#e2e8f0" }}>{centerName}</p>
              <p style={{ margin: 0, fontSize: "10px", color: "#374151", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>Sub-Admin Portal</p>
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "20px", padding: "36px",
            backdropFilter: "blur(12px)",
          }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "14px",
              background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "18px",
              boxShadow: "0 4px 16px rgba(107,130,240,0.35)",
            }}>
              <Lock size={22} color="white" />
            </div>

            <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#374151", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              New Password
            </p>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: "800", color: "#e2e8f0", letterSpacing: "-0.3px" }}>
              Reset Password
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: "13.5px", color: "#374151", lineHeight: "1.6" }}>
              Enter a new password for your sub-admin account. Minimum 8 characters.
            </p>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px", padding: "11px 14px", marginBottom: "18px",
                fontSize: "13px", color: "#fca5a5",
              }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* New password */}
              <div>
                <label style={labelSt}>New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused("pw")}
                    onBlur={() => setFocused("")}
                    placeholder="At least 8 characters"
                    required
                    style={{
                      ...inputSt,
                      paddingRight: "44px",
                      border: `1px solid ${focused === "pw" ? "rgba(107,130,240,0.5)" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: focused === "pw" ? "0 0 0 3px rgba(107,130,240,0.08)" : "none",
                    }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={eyeBtnSt}>
                    {showPw ? <EyeOff size={15} color="#374151" /> : <Eye size={15} color="#374151" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label style={labelSt}>Confirm Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => setFocused("")}
                    placeholder="Repeat your new password"
                    required
                    style={{
                      ...inputSt,
                      paddingRight: "44px",
                      border: `1px solid ${focused === "confirm" ? "rgba(107,130,240,0.5)" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: focused === "confirm" ? "0 0 0 3px rgba(107,130,240,0.08)" : "none",
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeBtnSt}>
                    {showConfirm ? <EyeOff size={15} color="#374151" /> : <Eye size={15} color="#374151" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "13px",
                  background: loading ? "rgba(79,99,210,0.4)" : "linear-gradient(135deg, #4f63d2, #6b82f0)",
                  color: "white", border: "none", borderRadius: "12px",
                  fontSize: "14.5px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(107,130,240,0.35)",
                  transition: "all 0.2s", marginTop: "4px",
                }}
              >
                {loading
                  ? <><Loader2 size={16} style={{ animation: "sa-rp-spin 0.8s linear infinite" }} /> Resetting…</>
                  : "Reset Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

function Orbs() {
  return (
    <>
      <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,99,210,0.07) 0%, transparent 65%)", top: "-120px", left: "-120px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 65%)", bottom: "-80px", right: "-80px", pointerEvents: "none" }} />
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

const eyeBtnSt = {
  position: "absolute", right: "14px", top: "50%",
  transform: "translateY(-50%)", background: "none",
  border: "none", cursor: "pointer", padding: 0,
  display: "flex", alignItems: "center",
};

const css = `
  * { box-sizing: border-box; }
  @keyframes sa-rp-spin { to { transform: rotate(360deg); } }
`;
