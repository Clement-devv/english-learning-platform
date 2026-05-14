import { useState, useEffect } from "react";

const KEY = "viewMode"; // stored value: "desktop" | "mobile" | absent = auto

function compute() {
  const saved = localStorage.getItem(KEY);
  if (saved === "desktop") return false;
  if (saved === "mobile")  return true;
  // Default is always desktop — user must explicitly opt in to mobile view.
  return false;
}

export function useViewMode() {
  const [isMobile, setIsMobile] = useState(compute);

  useEffect(() => {
    const handler = () => setIsMobile(compute());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // "desktop" | "mobile" | null (auto)
  const [forcedMode, setForcedMode] = useState(() => localStorage.getItem(KEY));

  const setViewMode = (mode) => {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
    setForcedMode(mode === "auto" ? null : mode);
    // Sync viewport meta so desktop/mobile UIs render at the correct scale
    const vp = document.getElementById("vp");
    if (vp) {
      const useMobile = mode !== "desktop" && window.screen.width < 768;
      vp.content = useMobile
        ? "width=device-width, initial-scale=1.0, viewport-fit=cover"
        : "width=1280, viewport-fit=cover";
    }
    setIsMobile(compute());
  };

  return { isMobile, forcedMode, setViewMode };
}
