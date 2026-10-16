// src/components/DashToast.jsx
// The floating dashboard alert card (new messages, missed calls) — warm glass in the
// Sunshine style. Styles: .ntf in src/index.css (light + dark, phone width, motion).
import { X } from "lucide-react";

/**
 * @param {"accent"|"red"} tone  — icon tile colour
 * @param {import("react").ComponentType} icon  — lucide icon
 * @param {number} count  — shown as a badge on the icon
 * @param {number} offset — stack position (0 = first card, 1 = below it)
 */
export default function DashToast({ tone = "accent", icon: Icon, count, title, sub, onDismiss, offset = 0 }) {
  return (
    <div className={`ntf ntf--${tone}`} role="status" aria-live="polite" style={{ "--ntf-i": offset }}>
      <button type="button" className="ntf-body" onClick={onDismiss} title="Dismiss">
        <span className="ntf-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={2.3} />
          {count > 0 && <span className="ntf-count">{count > 99 ? "99+" : count}</span>}
        </span>
        <span className="ntf-text">
          <span className="ntf-title">{title}</span>
          <span className="ntf-sub">{sub}</span>
        </span>
      </button>
      <button type="button" className="ntf-close" onClick={onDismiss} aria-label="Dismiss">
        <X size={15} strokeWidth={2.6} />
      </button>
    </div>
  );
}
