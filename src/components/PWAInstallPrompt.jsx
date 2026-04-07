// src/components/PWAInstallPrompt.jsx
// Shows a bottom banner prompting the user to install the app.
// The browser fires "beforeinstallprompt" only when all PWA criteria are met.

import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState(null);   // deferred install event
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed / running in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (window.navigator.standalone) return; // iOS standalone

    // Detect iOS (Safari doesn't fire beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) {
      const dismissed = sessionStorage.getItem("pwa-ios-dismissed");
      if (!dismissed) {
        setIsIOS(true);
        setVisible(true);
      }
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        setPrompt(e);
        setVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    if (isIOS) {
      sessionStorage.setItem("pwa-ios-dismissed", "1");
    } else {
      localStorage.setItem("pwa-install-dismissed", "1");
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "min(420px, calc(100vw - 32px))",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        padding: "16px 20px",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        border: "1px solid #ede9fe",
        animation: "pwa-slide-up 0.3s ease",
      }}
    >
      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div
        style={{
          width: "42px",
          height: "42px",
          background: "#ede9fe",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Download size={20} color="#7c3aed" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "14px", fontWeight: "700", color: "#1e1b4b", marginBottom: "4px" }}>
          Install the app
        </p>
        {isIOS ? (
          <p style={{ fontSize: "12px", color: "#6b7280", lineHeight: "1.5" }}>
            Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> to install.
          </p>
        ) : (
          <p style={{ fontSize: "12px", color: "#6b7280", lineHeight: "1.5" }}>
            Add to your home screen for a faster, app-like experience — works offline too.
          </p>
        )}

        {/* Install button (Android / Desktop only) */}
        {!isIOS && (
          <button
            onClick={handleInstall}
            style={{
              marginTop: "10px",
              background: "#7c3aed",
              color: "white",
              border: "none",
              padding: "7px 16px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Install
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9ca3af",
          padding: "2px",
          flexShrink: 0,
          display: "flex",
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
