import { useState, useEffect } from "react";

const KEY = "viewMode"; // stored value: "desktop" | "mobile" | absent = auto

const isPhone = () => window.screen.width < 768;
// iPad / Android tablet. iPadOS reports itself as a Mac, so detect by touch + screen size
// (shorter side ≥ 600, longer side ≤ 1366 — the largest iPad Pro). Mirrors index.html.
export const isTablet = () => {
  const s = window.screen;
  return navigator.maxTouchPoints > 1 && !isPhone()
    && Math.min(s.width, s.height) >= 600 && Math.max(s.width, s.height) <= 1366;
};

// `phoneDefault`: with no saved choice, phones get the mobile (touch) layout, and so do
// tablets in portrait (< 1024 px wide); tablets in landscape get the desktop layout at
// their real width. This matches the viewport index.html sets for those devices, so the
// desktop layout is never squeezed into a small screen. Shells that haven't had their
// touch layout rebuilt yet still default to desktop (an explicit "mobile" choice wins).
function compute(phoneDefault) {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
  if (saved === "desktop") return false;
  if (saved === "mobile")  return true;
  if (!phoneDefault) return false;
  if (isPhone()) return true;
  return isTablet() && window.innerWidth < 1024;
}

export function useViewMode({ phoneDefault = false } = {}) {
  const [isMobile, setIsMobile] = useState(() => compute(phoneDefault));
  // where the "switch to mobile view" shortcut is offered: phones, plus tablets on
  // shells that opted in (phoneDefault) — the others still render tablets at 1280px
  const [isSmallScreen, setIsSmallScreen] = useState(() => isPhone() || (phoneDefault && isTablet()));
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const handler = () => {          // also fires on tablet rotation
      setIsMobile(compute(phoneDefault));
      setIsSmallScreen(isPhone() || (phoneDefault && isTablet()));
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [phoneDefault]);

  // "desktop" | "mobile" | null (auto)
  const [forcedMode, setForcedMode] = useState(() => localStorage.getItem(KEY));

  const setViewMode = (mode) => {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
    setForcedMode(mode === "auto" ? null : mode);
    // Sync viewport meta so desktop/mobile UIs render at the correct scale
    // (index.html's __applyViewport also pins the desktop scale on touch screens)
    const touchDevice = isPhone() || (phoneDefault && isTablet());
    const useDeviceWidth = mode !== "desktop" && touchDevice;
    const vp = document.getElementById("vp");
    if (window.__applyViewport) window.__applyViewport(useDeviceWidth);
    else if (vp) {
      vp.content = useDeviceWidth
        ? "width=device-width, initial-scale=1.0, viewport-fit=cover"
        : "width=1280, viewport-fit=cover";
    }
    setIsMobile(compute(phoneDefault));
    setViewportWidth(window.innerWidth);
  };

  return { isMobile, forcedMode, setViewMode, isSmallScreen, viewportWidth };
}
