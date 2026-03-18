// src/components/GoogleTranslate.jsx
// Renders the Google Translate dropdown.
// The widget itself is initialised globally in index.html —
// this component just mounts the target <div> and shows a globe icon beside it.

import { useEffect } from "react";
import { Globe } from "lucide-react";

export default function GoogleTranslate({ isDarkMode = false }) {
  useEffect(() => {
    // If the page was already translated (cookie persists), Google will
    // re-apply automatically. Nothing extra needed here.
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
      title="Translate page"
    >
      <Globe
        size={15}
        style={{ color: isDarkMode ? "#a78bfa" : "#7c3aed", flexShrink: 0 }}
      />
      {/* Google Translate injects its <select> inside this div */}
      <div id="google_translate_element" />
    </div>
  );
}
