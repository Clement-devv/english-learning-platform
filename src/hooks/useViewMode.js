import { useState, useEffect } from "react";

const KEY = "viewMode"; // stored value: "desktop" | "mobile" | absent = auto

function compute() {
  const saved = localStorage.getItem(KEY);
  if (saved === "desktop") return false;
  if (saved === "mobile")  return true;
  // Use screen.width (physical device width) so viewport meta overrides don't fool us.
  // The app sets viewport=1280 for app pages, which makes innerWidth unreliable on phones.
  return window.screen.width < 768;
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
