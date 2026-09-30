// src/components/ManagedBadge.jsx
// Marks a managed student — no login, run by the center admin — so teachers
// don't expect them to open the app, join via their own account, or reply to messages.
import React from "react";

export default function ManagedBadge({ isDarkMode = false, style }) {
  return (
    <span
      title="Managed student: no login, the center admin manages this student"
      style={{
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "1px 7px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: isDarkMode ? "rgba(245,158,11,0.15)" : "#fef3c7",
        color: isDarkMode ? "#fcd34d" : "#b45309",
        ...style,
      }}
    >
      Managed
    </span>
  );
}
