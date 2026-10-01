// src/components/DisputePulse.jsx
// "Heartbeat" signals on class rows:
//   tone="red"   — a parent/student disputed the class; auto-resolves for them at
//                  `deadline` unless an admin settles it first (server/utils/parentCheck.js)
//   tone="amber" — a teacher-logged class waiting for admin approval before any
//                  pay is added (server/routes/offlineClassRoutes.js)
import { useEffect, useState } from "react";

const CSS = `
@keyframes dp-beat {
  0%, 40%, 100% { transform: scale(1); }
  10% { transform: scale(1.3); }
  20% { transform: scale(1.05); }
  30% { transform: scale(1.22); }
}
@keyframes dp-ring {
  0%   { transform: scale(1);   opacity: .75; }
  70%  { transform: scale(2.8); opacity: 0; }
  100% { transform: scale(2.8); opacity: 0; }
}
@keyframes dp-glow {
  0%, 40%, 100% { box-shadow: 0 0 0 1.5px rgba(220,38,38,.55), 0 0 0 0 rgba(220,38,38,.0); }
  10%, 30%      { box-shadow: 0 0 0 2px rgba(220,38,38,.9),   0 0 22px 4px rgba(220,38,38,.35); }
}
@keyframes dp-glow-amber {
  0%, 40%, 100% { box-shadow: 0 0 0 1.5px rgba(217,119,6,.55), 0 0 0 0 rgba(217,119,6,0); }
  10%, 30%      { box-shadow: 0 0 0 2px rgba(217,119,6,.9),   0 0 22px 4px rgba(245,158,11,.35); }
}
.dp-dot  { position: relative; width: 12px; height: 12px; flex-shrink: 0; }
.dp-amber .dp-core { background: #d97706; }
.dp-amber .dp-ring { border-color: #d97706; }
.dp-glow-amber { animation: dp-glow-amber 1.4s ease-in-out infinite; border-color: #d97706 !important; }
.dp-core { position: absolute; inset: 0; border-radius: 50%; background: #dc2626; animation: dp-beat 1.2s ease-in-out infinite; }
.dp-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid #dc2626; animation: dp-ring 1.2s ease-out infinite; }
/* Put on the whole card/row of a disputed class */
.dp-glow { animation: dp-glow 1.2s ease-in-out infinite; border-color: #dc2626 !important; }
@media (prefers-reduced-motion: reduce) {
  .dp-core, .dp-ring, .dp-glow, .dp-glow-amber { animation: none !important; }
  .dp-glow { box-shadow: 0 0 0 2px #dc2626 !important; }
  .dp-glow-amber { box-shadow: 0 0 0 2px #d97706 !important; }
  .dp-ring { display: none; }
}
`;

let injected = false;
function useStyles() {
  useEffect(() => {
    if (injected || document.getElementById("dp-styles")) { injected = true; return; }
    const el = document.createElement("style");
    el.id = "dp-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

/** Class name for the disputed card's container (adds the pulsing red glow). */
export const DISPUTE_GLOW_CLASS = "dp-glow";
/** Class name for a card awaiting admin approval (pulsing amber glow). */
export const AWAITING_GLOW_CLASS = "dp-glow-amber";

function timeLeft(deadline) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "auto-refund due now";
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  if (d >= 1) return `auto-refund in ${d}d ${h % 24}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return h >= 1 ? `auto-refund in ${h}h ${m}m` : `auto-refund in ${m}m`;
}

/**
 * <DisputePulse deadline={...} label="Parent disputed" />
 * `compact` hides the countdown (just the beating dot + label).
 */
export default function DisputePulse({ deadline, label = "Parent disputed", compact = false, tone = "red", style }) {
  useStyles();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <span role="status" aria-live="off"
      title={tone === "amber"
        ? "Logged by the teacher outside the app. Nothing is charged or paid until an admin approves it."
        : "A parent or student reported that this class didn't happen. Settle it in Disputes before the deadline, or it's resolved in their favour automatically."}
      className={tone === "amber" ? "dp-amber" : undefined}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 8px", borderRadius: 999,
        background: tone === "amber" ? "#fef3c7" : "#fee2e2", color: tone === "amber" ? "#92400e" : "#b91c1c",
        fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", ...style }}>
      <span className="dp-dot" aria-hidden="true"><span className="dp-ring" /><span className="dp-core" /></span>
      {label}
      {!compact && deadline && <span style={{ fontWeight: 600 }}>· {timeLeft(deadline)}</span>}
    </span>
  );
}
