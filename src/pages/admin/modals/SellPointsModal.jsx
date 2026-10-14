// src/pages/admin/modals/SellPointsModal.jsx
// Admin: sell group-class points to a student (points are only for group classes —
// separate from class credits). Shows the balance and the recent points history.
// Server: routes/groupPointsRoutes.js
import { useEffect, useState } from "react";
import { X, Ticket, Loader2 } from "lucide-react";
import api from "../../../api";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

const BRAND = "var(--brand-primary, #2563eb)";
const METHODS = ["cash", "bank_transfer", "card", "online", "other"];
const fmtDay = (d) => new Date(d).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });

export default function SellPointsModal({ student, isDarkMode, onClose, onSold }) {
  const { t: tr } = useTranslation("admin");
  const [info, setInfo]       = useState(null);
  const [pricing, setPricing] = useState(null);
  const [points, setPoints]   = useState("");
  const [amount, setAmount]   = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod]   = useState("cash");
  const [note, setNote]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const c = isDarkMode
    ? { card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#8b91b8", input: "#0f1117", soft: "#141620" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#475569", muted: "#94a3b8", input: "#f8faff", soft: "#f8fafc" };

  useEffect(() => {
    api.get(`/group-points/students/${student._id}`).then(({ data }) => setInfo(data)).catch(() => setError(tr("sellPointsModal.couldNotLoad")));
    api.get("/class-pricing").then(({ data }) => setPricing(data)).catch(() => {});
  }, [student._id, tr]);

  // Fill in the amount from the price per point (until the admin types their own)
  const n = Number(points);
  const perPoint = Number(pricing?.pricePerPoint) || 0;
  useEffect(() => {
    if (!amountTouched && perPoint > 0 && Number.isInteger(n) && n > 0) setAmount(String(Math.round(n * perPoint * 100) / 100));
  }, [n, perPoint, amountTouched]);

  const valid = Number.isInteger(n) && n >= 1 && n <= 10000;
  const sym = pricing?.currencySymbol || "";

  const save = async () => {
    if (!valid) return setError(tr("sellPointsModal.pointsRange"));
    setSaving(true); setError("");
    try {
      const { data } = await api.post(`/group-points/students/${student._id}/sell`, { points: n, amountPaid: amount === "" ? undefined : Number(amount), method, note });
      onSold?.(data.balance, n);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || tr("sellPointsModal.couldNotSave"));
    } finally { setSaving(false); }
  };

  const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 14, fontFamily: "inherit" };
  const label = { display: "block", fontSize: 12, fontWeight: 700, color: c.body, margin: "0 0 6px" };
  const kindLabel = { purchase: tr("sellPointsModal.kindPurchase"), spend: tr("sellPointsModal.kindSpend"), refund: tr("sellPointsModal.kindRefund"), adjust: tr("sellPointsModal.kindAdjust") };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: c.card, borderRadius: 18, border: `1px solid ${c.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${c.border}` }}>
          <Ticket size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: c.heading }}>{tr("sellPointsModal.title")}</p>
            <p style={{ margin: 0, fontSize: 12, color: c.muted }}>{student.firstName} {student.lastName} · {tr("sellPointsModal.onlyForGroup")}</p>
          </div>
          <button onClick={onClose} aria-label={tr("sellPointsModal.close")} style={{ background: "none", border: "none", cursor: "pointer", color: c.muted }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "12px 14px", borderRadius: 12, background: c.soft, border: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: c.body }}>{tr("sellPointsModal.balance")}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: c.heading }}>{info ? info.balance : "…"}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label} htmlFor="sp-points">{tr("sellPointsModal.points")}</label>
              <input id="sp-points" type="number" min="1" step="1" value={points} onChange={(e) => setPoints(e.target.value)} style={input} placeholder="10" />
            </div>
            <div>
              <label style={label} htmlFor="sp-amount">{tr("sellPointsModal.amountPaid", { sym })}</label>
              <input id="sp-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setAmountTouched(true); }} style={input} placeholder="0" />
            </div>
          </div>
          {perPoint > 0 && <p style={{ margin: "-6px 0 0", fontSize: 12, color: c.muted }}>{tr("sellPointsModal.pricePerPoint", { price: `${sym}${perPoint}` })}</p>}

          <div>
            <label style={label} htmlFor="sp-method">{tr("sellPointsModal.method")}</label>
            <select id="sp-method" value={method} onChange={(e) => setMethod(e.target.value)} style={input}>
              {METHODS.map((m) => <option key={m} value={m}>{tr(`sellPointsModal.methods.${m}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={label} htmlFor="sp-note">{tr("sellPointsModal.note")}</label>
            <input id="sp-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} style={input} />
          </div>

          {error && <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${c.border}`, background: "transparent", color: c.body, fontWeight: 700, cursor: "pointer" }}>{tr("sellPointsModal.cancel")}</button>
            <button onClick={save} disabled={!valid || saving} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontWeight: 800, cursor: valid && !saving ? "pointer" : "not-allowed", opacity: valid && !saving ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6 }}>
              {saving && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
              {valid ? tr("sellPointsModal.addPoints", { count: n }) : tr("sellPointsModal.addPointsEmpty")}
            </button>
          </div>

          {info?.history?.length > 0 && (
            <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: c.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{tr("sellPointsModal.history")}</p>
              {info.history.slice(0, 8).map((h) => (
                <div key={h._id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "5px 0", color: c.body }}>
                  <span>{fmtDay(h.createdAt)} · {kindLabel[h.kind] || h.kind}{h.classTitle ? ` · ${h.classTitle}` : ""}</span>
                  <strong style={{ color: h.points > 0 ? "#059669" : "#b91c1c" }}>{h.points > 0 ? `+${h.points}` : h.points}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
