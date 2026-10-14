// src/components/groupClass/PlatformPicker.jsx
// Where a group class happens: Agora (in the app), Google Meet or Zoom.
// Meet / Zoom: an optional link for this class — empty uses the teacher's saved link.
// Only platforms the center has switched on are offered (center.features).
import { getCachedCenter } from "../../utils/branding";
import { PLATFORM_META } from "./platforms";

const FEATURE = { agora: "agora", googlemeet: "googleMeet", zoom: "zoom" };

export default function PlatformPicker({ platform = "agora", link = "", onChange, col, labels = {} }) {
  const features = getCachedCenter()?.features || {};
  const L = {
    agoraHint: "In the app — students join here",
    externalHint: "Opens in a new tab",
    linkPlaceholder: "Paste a link for this class (optional)",
    linkHint: "Leave empty to use the teacher's saved link.",
    ...labels,
  };
  const options = Object.keys(PLATFORM_META).filter((p) => features[FEATURE[p]] !== false);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {options.map((p) => {
          const on = platform === p;
          return (
            <button type="button" key={p} onClick={() => onChange({ platform: p, link: p === platform ? link : "" })}
              style={{ flex: "1 1 120px", textAlign: "left", padding: "10px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                border: `2px solid ${on ? col.accent : col.border}`, background: on ? col.accent + "18" : "transparent" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: on ? col.accent : col.heading }}>{PLATFORM_META[p].icon} {PLATFORM_META[p].name}</div>
              <div style={{ fontSize: 11, color: col.muted, marginTop: 2 }}>{p === "agora" ? L.agoraHint : L.externalHint}</div>
            </button>
          );
        })}
      </div>
      {platform !== "agora" && (
        <div style={{ marginTop: 8 }}>
          <input value={link} onChange={(e) => onChange({ platform, link: e.target.value })} placeholder={L.linkPlaceholder}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${col.border}`, background: "transparent", color: col.heading, fontSize: 13, fontFamily: "inherit" }} />
          <p style={{ fontSize: 11.5, color: col.muted, margin: "4px 0 0" }}>{L.linkHint}</p>
        </div>
      )}
    </div>
  );
}
