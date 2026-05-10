import { useState, useEffect } from "react";

const KEY = "viewMode"; // stored value: "desktop" | "mobile" | absent = auto

function compute() {
  const saved = localStorage.getItem(KEY);
  if (saved === "desktop") return false;
  if (saved === "mobile")  return true;
  return window.innerWidth < 768;
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
    setIsMobile(compute());
  };

  return { isMobile, forcedMode, setViewMode };
}
