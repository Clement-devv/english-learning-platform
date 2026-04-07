// src/pages/admin/tabs/ClassPricingTab.jsx
import React, { useState, useEffect } from "react";
import { DollarSign, Save, RefreshCw, BookOpen, Calculator } from "lucide-react";
import api from "../../../api";

const CURRENCIES = [
  { code: "USD", symbol: "$",  label: "USD — US Dollar"        },
  { code: "GBP", symbol: "£",  label: "GBP — British Pound"    },
  { code: "EUR", symbol: "€",  label: "EUR — Euro"             },
  { code: "NGN", symbol: "₦",  label: "NGN — Nigerian Naira"   },
  { code: "VND", symbol: "₫",  label: "VND — Vietnamese Dong"  },
  { code: "JPY", symbol: "¥",  label: "JPY — Japanese Yen"     },
  { code: "KRW", symbol: "₩",  label: "KRW — South Korean Won" },
  { code: "BRL", symbol: "R$", label: "BRL — Brazilian Real"   },
  { code: "MXN", symbol: "$",  label: "MXN — Mexican Peso"     },
  { code: "INR", symbol: "₹",  label: "INR — Indian Rupee"     },
  { code: "AUD", symbol: "A$", label: "AUD — Australian Dollar"},
  { code: "CAD", symbol: "C$", label: "CAD — Canadian Dollar"  },
  { code: "SGD", symbol: "S$", label: "SGD — Singapore Dollar" },
  { code: "SAR", symbol: "﷼",  label: "SAR — Saudi Riyal"      },
  { code: "AED", symbol: "د.إ",label: "AED — UAE Dirham"       },
  { code: "EGP", symbol: "£",  label: "EGP — Egyptian Pound"   },
  { code: "TRY", symbol: "₺",  label: "TRY — Turkish Lira"     },
  { code: "ZAR", symbol: "R",  label: "ZAR — South African Rand"},
  { code: "OTHER", symbol: "",  label: "Other / Custom"        },
];

export default function ClassPricingTab({ isDarkMode }) {
  const [price,    setPrice]    = useState("");
  const [currency, setCurrency] = useState("USD");
  const [symbol,   setSymbol]   = useState("$");
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState(null); // { type: 'success'|'error', text }
  const [calc,     setCalc]     = useState("");   // calculator input

  const dm = isDarkMode;
  const bg      = dm ? "#1e293b" : "#ffffff";
  const pageBg  = dm ? "#0f172a" : "#f8fafc";
  const border  = dm ? "#334155" : "#e2e8f0";
  const textPri = dm ? "#f1f5f9" : "#1e293b";
  const textSec = dm ? "#94a3b8" : "#64748b";
  const inputBg = dm ? "#0f172a" : "#ffffff";
  const lbl     = { display: "block", fontSize: "12px", fontWeight: "700", color: dm ? "#94a3b8" : "#374151", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" };
  const inp     = { width: "100%", padding: "10px 13px", borderRadius: "10px", border: `1.5px solid ${border}`, background: inputBg, color: textPri, fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  useEffect(() => {
    api.get("/class-pricing")
      .then(r => {
        if (r.data) {
          setPrice(String(r.data.pricePerClass));
          setCurrency(r.data.currency || "USD");
          setSymbol(r.data.currencySymbol || "$");
          setNotes(r.data.notes || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Sync symbol when currency changes (unless Other)
  const handleCurrencyChange = (e) => {
    const c = CURRENCIES.find(x => x.code === e.target.value);
    setCurrency(e.target.value);
    if (c && c.code !== "OTHER") setSymbol(c.symbol);
  };

  const handleSave = async () => {
    if (!price || isNaN(Number(price)) || Number(price) < 0) {
      setMsg({ type: "error", text: "Please enter a valid price per class" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.put("/class-pricing", {
        pricePerClass: Number(price),
        currency,
        currencySymbol: symbol,
        notes,
      });
      setMsg({ type: "success", text: "Pricing saved successfully!" });
    } catch {
      setMsg({ type: "error", text: "Failed to save pricing" });
    } finally {
      setSaving(false);
    }
  };

  const calcTotal = calc && !isNaN(Number(calc)) && Number(price)
    ? (Number(calc) * Number(price)).toFixed(2)
    : null;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", background: pageBg }}>
        <RefreshCw size={24} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: pageBg, minHeight: "100vh", padding: "28px 24px", fontFamily: "var(--font-body)" }}>

      {/* Page heading */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "800", color: textPri, margin: 0 }}>Class Pricing</h1>
        <p style={{ fontSize: "13px", color: textSec, margin: "4px 0 0" }}>
          Set the price per class and currency for your center. Payments recorded via Manual Payment will auto-calculate the total.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", maxWidth: "860px" }}>

        {/* ── Pricing config card ── */}
        <div style={{ background: bg, borderRadius: "16px", border: `1px solid ${border}`, padding: "24px", boxShadow: dm ? "none" : "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ background: "linear-gradient(135deg,#6366f1,#818cf8)", borderRadius: "10px", padding: "8px", display: "flex" }}>
              <DollarSign size={16} color="#fff" />
            </div>
            <h2 style={{ fontSize: "15px", fontWeight: "700", color: textPri, margin: 0 }}>Pricing Settings</h2>
          </div>

          {/* Price per class */}
          <div style={{ marginBottom: "16px" }}>
            <label style={lbl}>Price Per Class *</label>
            <input
              style={inp}
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g. 20"
              min="0"
              step="0.01"
            />
          </div>

          {/* Currency select */}
          <div style={{ marginBottom: "16px" }}>
            <label style={lbl}>Currency</label>
            <select
              value={currency}
              onChange={handleCurrencyChange}
              style={{ ...inp, appearance: "none", cursor: "pointer" }}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Currency symbol (editable for "Other") */}
          <div style={{ marginBottom: "16px" }}>
            <label style={lbl}>Currency Symbol</label>
            <input
              style={inp}
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              placeholder="e.g. $"
              maxLength={5}
            />
            <p style={{ fontSize: "11px", color: textSec, marginTop: "4px" }}>Auto-filled from currency selection. Edit for custom currencies.</p>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "20px" }}>
            <label style={lbl}>Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Price includes materials. Packages discounts available on request."
              rows={2}
              style={{ ...inp, resize: "vertical", lineHeight: "1.5" }}
            />
          </div>

          {/* Feedback message */}
          {msg && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px", marginBottom: "14px",
              background: msg.type === "success" ? (dm ? "rgba(16,185,129,0.1)" : "#f0fdf4") : (dm ? "rgba(239,68,68,0.1)" : "#fef2f2"),
              border: `1px solid ${msg.type === "success" ? (dm ? "#064e3b" : "#a7f3d0") : (dm ? "#7f1d1d" : "#fecaca")}`,
              color: msg.type === "success" ? (dm ? "#34d399" : "#065f46") : (dm ? "#f87171" : "#dc2626"),
              fontSize: "13px", fontWeight: "600",
            }}>
              {msg.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: saving ? "#94a3b8" : "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Save size={15} />
            {saving ? "Saving…" : "Save Pricing"}
          </button>
        </div>

        {/* ── Calculator / preview card ── */}
        <div style={{ background: bg, borderRadius: "16px", border: `1px solid ${border}`, padding: "24px", boxShadow: dm ? "none" : "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ background: "linear-gradient(135deg,#10b981,#059669)", borderRadius: "10px", padding: "8px", display: "flex" }}>
              <Calculator size={16} color="#fff" />
            </div>
            <h2 style={{ fontSize: "15px", fontWeight: "700", color: textPri, margin: 0 }}>Price Calculator</h2>
          </div>

          {/* Current rate display */}
          <div style={{ background: dm ? "#0f172a" : "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "20px", border: `1px solid ${border}` }}>
            <p style={{ fontSize: "12px", color: textSec, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700" }}>Current Rate</p>
            {price && Number(price) > 0 ? (
              <p style={{ fontSize: "24px", fontWeight: "800", color: "#6366f1", margin: 0 }}>
                {symbol}{Number(price).toLocaleString()} <span style={{ fontSize: "14px", color: textSec, fontWeight: "600" }}>per class</span>
              </p>
            ) : (
              <p style={{ fontSize: "14px", color: textSec, margin: 0 }}>Not set yet — enter a price and save.</p>
            )}
          </div>

          {/* Calculator input */}
          <div style={{ marginBottom: "16px" }}>
            <label style={lbl}>Number of Classes to Price</label>
            <input
              style={inp}
              type="number"
              value={calc}
              onChange={e => setCalc(e.target.value)}
              placeholder="e.g. 10"
              min="1"
            />
          </div>

          {/* Result */}
          <div style={{ background: dm ? "#0f172a" : "#f0f7ff", borderRadius: "12px", padding: "16px", border: `1px solid ${dm ? border : "#bfdbfe"}` }}>
            <p style={{ fontSize: "12px", color: textSec, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700" }}>Total Cost</p>
            <p style={{ fontSize: "28px", fontWeight: "800", color: dm ? "#818cf8" : "#4f46e5", margin: 0 }}>
              {calcTotal != null
                ? `${symbol}${Number(calcTotal).toLocaleString()}`
                : <span style={{ fontSize: "16px", color: textSec, fontWeight: "600" }}>Enter classes above</span>
              }
            </p>
            {calcTotal != null && (
              <p style={{ fontSize: "12px", color: textSec, margin: "4px 0 0" }}>
                {calc} class{Number(calc) !== 1 ? "es" : ""} × {symbol}{Number(price).toLocaleString()} = {symbol}{Number(calcTotal).toLocaleString()} {currency}
              </p>
            )}
          </div>

          {/* Usage tip */}
          <div style={{ marginTop: "16px", padding: "12px 14px", borderRadius: "10px", background: dm ? "rgba(99,102,241,0.08)" : "#f5f3ff", border: `1px solid ${dm ? "#312e81" : "#e9d5ff"}` }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <BookOpen size={14} color={dm ? "#818cf8" : "#7c3aed"} style={{ flexShrink: 0, marginTop: "1px" }} />
              <p style={{ fontSize: "12px", color: dm ? "#a5b4fc" : "#6d28d9", margin: 0, lineHeight: "1.5" }}>
                When you record a payment for a student, the amount will auto-calculate based on this rate. You can always override it manually.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
