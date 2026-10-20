// src/components/admin/FamilyEmailSwitch.jsx
// Center switch for an automatic after-class email to families (admin Recordings and
// Class summaries pages). Flipping it sets EVERY managed student — afterwards admins
// turn single students on/off in Students → ⋯ → Notifications & reminders.
// Server: PUT /recording-links/settings (server/utils/familyEmailPrefs.js).
import { useState, useEffect, useCallback } from "react";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api";

/** kind: "recordingLinkEmails" (class videos) | "classSummaryEmails" (class summaries) */
export default function FamilyEmailSwitch({ kind, title, help, onToast }) {
  const { t } = useTranslation("admin");
  const tr = (key, def, opts) => t(`familyEmails.${key}`, def, opts);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get("/recording-links/settings").then(({ data: res }) => setData(res.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  const on = !!data[kind];
  const counts = data.counts?.[kind] || { withEmail: 0, on: 0 };

  const toggle = async () => {
    const next = !on;
    const msg = next
      ? tr("confirmOn", "Turn this on for all {{n}} families with an email address?", { n: counts.withEmail })
      : tr("confirmOff", "Turn this off for all {{n}} families? You can turn single students back on in Students → ⋯ → Notifications & reminders.", { n: counts.withEmail });
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      const { data: res } = await api.put("/recording-links/settings", { [kind]: next });
      setData(res.data);
      onToast?.(next ? tr("savedOn", "Turned on for every family") : tr("savedOff", "Turned off for every family"));
    } catch {
      onToast?.(tr("saveFailed", "Couldn't save — please try again"));
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--a-line)", background: "var(--a-surface)" }}>
      <Mail size={18} color="var(--a-accent-ink)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--a-ink)" }}>{title}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--a-ink-2)", marginTop: 2 }}>{help}</span>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--a-ink-2)", marginTop: 4 }}>
          {counts.withEmail === 0
            ? tr("noAddresses", "No managed student has a family email address yet (Students → ⋯ → Notifications & reminders).")
            : tr("reach", "On for {{on}} of {{n}} families with an email address", { on: counts.on, n: counts.withEmail })}
        </span>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={title} disabled={saving} onClick={toggle}
        style={{ position: "relative", width: 46, height: 26, borderRadius: 999, border: "none", flexShrink: 0, cursor: saving ? "wait" : "pointer",
          background: on ? "var(--a-accent)" : "var(--a-line-strong)", transition: "background-color 150ms ease" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 150ms ease" }} />
      </button>
    </div>
  );
}
