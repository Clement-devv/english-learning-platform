import React, { useState, useEffect } from "react";
import { DollarSign, BookOpen, X, AlertCircle, XCircle } from "lucide-react";
import api from "../../../api";
import { useTranslation } from "react-i18next";

export default function ManualPaymentModal({ isOpen, onClose, onSave, student, isDarkMode = false }) {
  const { t: tr } = useTranslation("admin");
  const [classes,      setClasses]      = useState("");
  const [amount,       setAmount]       = useState("");
  const [method,       setMethod]       = useState("Manual");
  const [pricing,      setPricing]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [amountError,  setAmountError]  = useState(""); // inline mismatch error

  // Fetch center pricing once per open
  useEffect(() => {
    if (!isOpen) return;
    setClasses("");
    setAmount("");
    setMethod("Manual");
    setAmountError("");
    setPricingLoading(true);
    api.get("/class-pricing")
      .then(r => setPricing(r.data))
      .catch(() => setPricing(null))
      .finally(() => setPricingLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const dm       = isDarkMode;
  const bg       = dm ? "#1e293b" : "#ffffff";
  const border   = dm ? "#334155" : "#e2e8f0";
  const textPri  = dm ? "#f1f5f9" : "#1e293b";
  const textSec  = dm ? "#94a3b8" : "#64748b";
  const inputBg  = dm ? "#0f172a" : "#f8fafc";
  const inputCol = dm ? "#f1f5f9" : "#1e293b";
  const lbl      = { display: "block", fontSize: "12px", fontWeight: "700", color: dm ? "#94a3b8" : "#374151", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" };
  const inp      = { width: "100%", padding: "10px 13px", borderRadius: "10px", border: `1.5px solid ${border}`, background: inputBg, color: inputCol, fontSize: "13.5px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const inpErr   = { ...inp, border: "1.5px solid #ef4444", background: dm ? "rgba(239,68,68,0.05)" : "#fff5f5" };

  const currSym  = pricing?.currencySymbol || "";
  const curr     = pricing?.currency || "";
  const ppc      = pricing?.pricePerClass;

  // ── Amount changed by admin ───────────────────────────────────────────────
  const handleAmountChange = (e) => {
    const val = e.target.value;
    setAmount(val);
    setAmountError("");

    if (!ppc || !val) { return; }

    const entered = Number(val);
    if (isNaN(entered) || entered <= 0) return;

    const implied = entered / ppc;
    if (Number.isInteger(implied) && implied > 0) {
      // Perfectly divisible — auto-fill classes
      setClasses(String(implied));
      setAmountError("");
    } else {
      // Does not match any whole number of classes
      const lower  = Math.floor(implied);
      const upper  = Math.ceil(implied);
      const hint   = lower > 0
        ? `${currSym}${(lower * ppc).toFixed(2)} for ${lower} class${lower > 1 ? "es" : ""} or ${currSym}${(upper * ppc).toFixed(2)} for ${upper} class${upper > 1 ? "es" : ""}`
        : `${currSym}${(upper * ppc).toFixed(2)} for ${upper} class${upper > 1 ? "es" : ""}`;
      setAmountError(tr("manualPaymentModal.cannotRecordIsNotA", { currSym, entered, ppc, value: curr || tr("manualPaymentModal.classWord"), hint }));
      setClasses("");
    }
  };

  // ── Classes changed by admin — auto-fill amount ───────────────────────────
  const handleClassesChange = (e) => {
    const val = e.target.value;
    setClasses(val);
    setAmountError("");

    if (ppc && val && !isNaN(Number(val)) && Number(val) > 0) {
      setAmount((Number(val) * ppc).toFixed(2));
    } else if (!val) {
      setAmount("");
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (amountError) return; // blocked by mismatch
    if (!amount || Number(amount) <= 0)
      return alert(tr("manualPaymentModal.pleaseEnterTheAmountPaid"));
    if (!classes || Number(classes) <= 0)
      return alert(tr("manualPaymentModal.pleaseEnterAValidNumber"));

    // Final guard: re-check mismatch
    if (ppc) {
      const expected = Number(classes) * ppc;
      if (Math.abs(Number(amount) - expected) > 0.01) {
        setAmountError(tr("manualPaymentModal.cannotRecordExpectedForClass", { currSym, value: expected.toFixed(2), classes, value2: Number(classes) > 1 ? "es" : "", ppc, value3: Number(amount).toFixed(2) }));
        return;
      }
    }

    setLoading(true);
    try {
      await onSave({ amount: Number(amount), classes: Number(classes), method });
    } finally {
      setLoading(false);
    }
  };

  const expectedAmount = ppc && classes && !isNaN(Number(classes)) && Number(classes) > 0
    ? (Number(classes) * ppc).toFixed(2)
    : null;

  const hasError   = !!amountError;
  const canSave    = !hasError && amount && Number(amount) > 0 && classes && Number(classes) > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
      <div style={{ background: bg, borderRadius: "20px", width: "100%", maxWidth: "460px", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", fontFamily: "var(--font-body)", border: dm ? `1px solid ${border}` : "none", overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "linear-gradient(135deg,#10b981,#059669)", borderRadius: "10px", padding: "8px", display: "flex" }}>
              <DollarSign size={16} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "800", color: textPri, margin: 0 }}>{tr("manualPaymentModal.recordPayment")}</h2>
              {student && (
                <p style={{ fontSize: "12px", color: textSec, margin: 0 }}>
                  {student.firstName} {student.lastName}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: textSec, padding: "4px", display: "flex", alignItems: "center" }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "20px 24px 24px" }}>

          {/* Pricing banner */}
          {!pricingLoading && (
            <div style={{
              background: pricing ? (dm ? "rgba(16,185,129,0.1)" : "#f0fdf4") : (dm ? "rgba(251,191,36,0.1)" : "#fffbeb"),
              border: `1px solid ${pricing ? (dm ? "#064e3b" : "#a7f3d0") : (dm ? "#78350f" : "#fde68a")}`,
              borderRadius: "12px", padding: "12px 14px", marginBottom: "18px", display: "flex", gap: "10px", alignItems: "flex-start",
            }}>
              {pricing ? (
                <>
                  <BookOpen size={15} color={dm ? "#34d399" : "#059669"} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    <p style={{ fontSize: "12.5px", fontWeight: "700", color: dm ? "#34d399" : "#059669", margin: "0 0 2px" }}>{tr("manualPaymentModal.centerPricingPerClass", { currSym, ppc, curr })}</p>
                    <p style={{ fontSize: "11.5px", color: dm ? "#6ee7b7" : "#065f46", margin: 0 }}>
                      {tr("manualPaymentModal.enterTheAmountPaidClasses")}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={15} color={dm ? "#fbbf24" : "#d97706"} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <p style={{ fontSize: "12px", color: dm ? "#fcd34d" : "#92400e", margin: 0 }}>
                    {tr("manualPaymentModal.noPricingSetGoTo")} <strong>{tr("manualPaymentModal.financeClassPricing")}</strong> {tr("manualPaymentModal.toConfigureRatesYouCan")}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Amount FIRST ── */}
          <div style={{ marginBottom: "14px" }}>
            <label style={lbl}>{tr("manualPaymentModal.amountPaid", { value: curr ? `(${curr})` : "" })}
            </label>
            <div style={{ position: "relative" }}>
              {currSym && (
                <span style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: textSec, fontSize: "14px", fontWeight: "600" }}>
                  {currSym}
                </span>
              )}
              <input
                style={{ ...(hasError ? inpErr : inp), paddingLeft: currSym ? "28px" : "13px" }}
                type="number"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            {/* Inline mismatch error */}
            {hasError && (
              <div style={{
                display: "flex", gap: "8px", alignItems: "flex-start",
                marginTop: "8px", padding: "10px 12px", borderRadius: "10px",
                background: dm ? "rgba(239,68,68,0.1)" : "#fef2f2",
                border: `1px solid ${dm ? "#7f1d1d" : "#fecaca"}`,
              }}>
                <XCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
                <p style={{ fontSize: "12px", color: dm ? "#f87171" : "#dc2626", margin: 0, lineHeight: "1.5", fontWeight: "600" }}>
                  {amountError}
                </p>
              </div>
            )}

            {/* Success hint when amount auto-filled classes */}
            {!hasError && amount && classes && expectedAmount && (
              <p style={{ fontSize: "11.5px", color: dm ? "#34d399" : "#059669", marginTop: "5px", fontWeight: "600" }}>{tr("manualPaymentModal.class", { currSym, amount, classes, value: Number(classes) !== 1 ? "es" : "", ppc })}
              </p>
            )}
          </div>

          {/* ── Classes SECOND ── */}
          <div style={{ marginBottom: "14px" }}>
            <label style={lbl}>{tr("manualPaymentModal.numberOfClasses")}</label>
            <input
              style={inp}
              type="number"
              value={classes}
              onChange={handleClassesChange}
              placeholder="e.g. 10"
              min="1"
            />
            {ppc && classes && !hasError && (
              <p style={{ fontSize: "11.5px", color: textSec, marginTop: "5px" }}>
                {classes} × {currSym}{ppc} = <strong style={{ color: dm ? "#818cf8" : "#4f46e5" }}>{currSym}{expectedAmount} {curr}</strong>
              </p>
            )}
          </div>

          {/* ── Payment method ── */}
          <div style={{ marginBottom: "20px" }}>
            <label style={lbl}>{tr("manualPaymentModal.paymentMethod")}</label>
            <div style={{ position: "relative" }}>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                style={{ ...inp, appearance: "none", paddingRight: "32px", cursor: "pointer" }}
              >
                <option value="Manual">{tr("manualPaymentModal.manualCash")}</option>
                <option value="Bank Transfer">{tr("manualPaymentModal.bankTransfer")}</option>
                <option value="Card">{tr("manualPaymentModal.card")}</option>
                <option value="Online">{tr("manualPaymentModal.onlinePayment")}</option>
                <option value="Other">{tr("manualPaymentModal.other")}</option>
              </select>
              <svg style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke={textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* ── Buttons ── */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: "11px", borderRadius: "10px", border: `1.5px solid ${border}`, background: "transparent", color: textSec, fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}
            >
              {tr("manualPaymentModal.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || hasError || !canSave}
              style={{
                flex: 2, padding: "11px", borderRadius: "10px", border: "none",
                background: (loading || hasError || !canSave) ? "#94a3b8" : "linear-gradient(135deg,#10b981,#059669)",
                color: "#fff", fontSize: "14px", fontWeight: "700",
                cursor: (loading || hasError || !canSave) ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? tr("manualPaymentModal.saving") : canSave && expectedAmount ? tr("manualPaymentModal.saveForClass", { currSym, amount, classes, value: Number(classes) !== 1 ? "es" : "" }) : tr("manualPaymentModal.savePayment")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
