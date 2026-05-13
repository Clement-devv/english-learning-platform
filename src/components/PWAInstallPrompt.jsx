// src/components/PWAInstallPrompt.jsx
import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PWAInstallPrompt() {
  const [prompt, setPrompt]   = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS]     = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (window.navigator.standalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) {
      if (!sessionStorage.getItem("pwa-ios-dismissed")) {
        setIsIOS(true);
        setVisible(true);
      }
      return;
    }

    const handler = (e) => {
      if (localStorage.getItem("pwa-install-dismissed")) return;
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    if (isIOS) sessionStorage.setItem("pwa-ios-dismissed", "1");
    else       localStorage.setItem("pwa-install-dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      width: "min(400px, calc(100vw - 24px))",
      background: "white",
      borderRadius: "12px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
      padding: "10px 12px 10px 14px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      border: "1px solid #ede9fe",
      animation: "pwa-slide-up 0.3s ease",
    }}>
      <style>{`
        @keyframes pwa-slide-up {
          from { opacity:0; transform:translateX(-50%) translateY(12px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Download size={16} color="#7c3aed" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: "700", color: "#1e1b4b", margin: 0, lineHeight: 1.3 }}>
          Install the app
        </p>
        <p style={{ fontSize: "11px", color: "#6b7280", margin: 0, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {isIOS ? "Tap Share → Add to Home Screen" : "Faster & works offline"}
        </p>
      </div>

      {/* Install button (Android/Desktop only) */}
      {!isIOS && (
        <button onClick={handleInstall} style={{
          background: "#7c3aed", color: "white", border: "none",
          padding: "6px 14px", borderRadius: "7px",
          fontSize: "12px", fontWeight: "600", cursor: "pointer",
          flexShrink: 0,
        }}>
          Install
        </button>
      )}

      {/* Dismiss */}
      <button onClick={handleDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "2px", flexShrink: 0, display: "flex" }}>
        <X size={16} />
      </button>
    </div>
  );
}
