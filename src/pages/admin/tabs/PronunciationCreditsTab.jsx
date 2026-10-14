import { useState, useEffect, useCallback } from "react";
import { Search, Mic, Plus, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import api from "../../../api";
import { getStudents } from "../../../services/studentService";
import { visibleEmail } from "../../../utils/managedStudent.js";
import { useTranslation } from "react-i18next";

const PRESET_AMOUNTS = [25, 50, 100, 150, 200, 500];

function StatCard({ label, value, emoji, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 16, padding: "18px 20px", border: `2px solid ${color}30` }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

export default function PronunciationCreditsTab({ isDarkMode }) {
  const { t: tr } = useTranslation("admin");
  const col = isDarkMode
    ? { bg: "var(--a-bg)", card: "var(--a-raised)", border: "var(--a-line)", heading: "var(--a-ink)", body: "var(--a-ink-2)", muted: "var(--a-ink-2)", input: "var(--a-raised)" }
    : { bg: "var(--a-raised)", card: "var(--a-surface)", border: "var(--a-line)", heading: "var(--a-ink)", body: "var(--a-ink-2)", muted: "var(--a-muted)", input: "#fff" };

  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [granting,  setGranting]  = useState(null);
  const [modal,     setModal]     = useState(null);
  const [amount,    setAmount]    = useState(50);
  const [customAmt, setCustomAmt] = useState("");
  const [note,      setNote]      = useState("");
  const [toast,     setToast]     = useState(null);
  const [budget,    setBudget]    = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBudget = useCallback(async () => {
    try {
      const { data } = await api.get("/pronunciation/center-credits");
      setBudget(data);
    } catch { /* non-fatal */ }
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const studentData = await getStudents();
      const allStudents = studentData.students || studentData || [];

      const withCredits = await Promise.all(
        allStudents.map(async (s) => {
          try {
            const { data } = await api.get(`/pronunciation/credits/student/${s._id}`);
            return { ...s, credits: data.credits ?? 0, totalUsed: data.totalUsed ?? 0 };
          } catch {
            return { ...s, credits: 0, totalUsed: 0 };
          }
        })
      );
      setStudents(withCredits);
    } catch (err) {
      showToast("Failed to load students: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStudents(); fetchBudget(); }, [fetchStudents, fetchBudget]);

  const openModal = (student) => {
    setModal({ student });
    setAmount(50);
    setCustomAmt("");
    setNote("");
  };

  const handleGrant = async () => {
    const finalAmount = customAmt ? parseInt(customAmt, 10) : amount;
    if (!finalAmount || finalAmount < 1 || finalAmount > 10000) {
      showToast(tr("pronunciationCreditsTab.enterAValidAmount1"), "error");
      return;
    }
    setGranting(modal.student._id);
    try {
      await api.post("/pronunciation/credits/grant", {
        studentId: modal.student._id,
        amount:    finalAmount,
        note:      note.trim() || "Granted by admin",
      });
      setStudents(prev => prev.map(s =>
        s._id === modal.student._id ? { ...s, credits: s.credits + finalAmount } : s
      ));
      fetchBudget();
      showToast(tr("pronunciationCreditsTab.creditsGrantedTo", { finalAmount, firstName: modal.student.firstName }));
      setModal(null);
    } catch (err) {
      showToast(err?.response?.data?.message || tr("pronunciationCreditsTab.failedToGrantCredits"), "error");
    } finally {
      setGranting(null);
    }
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return (
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  const totalCredits        = students.reduce((sum, s) => sum + (s.credits  || 0), 0);
  const totalUsed           = students.reduce((sum, s) => sum + (s.totalUsed || 0), 0);
  const studentsWithCredits = students.filter(s => s.credits > 0).length;
  const lowCreditStudents   = students.filter(s => s.credits > 0 && s.credits <= 5).length;

  return (
    <div style={{ fontFamily: "var(--font-body)", padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Toast */}
      {toast && (
        <div className="ui-toast-in" role="status" style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          padding: "12px 22px", borderRadius: 14, fontWeight: 700, fontSize: 14,
          background: toast.type === "error" ? "#fee2e2" : "#dcfce7",
          color:      toast.type === "error" ? "#dc2626" : "#16a34a",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>{toast.msg}</div>
      )}

      {/* Center Budget Banner */}
      {budget !== null && (() => {
        const bal   = budget.balance ?? 0;
        const low   = bal > 0 && bal <= 20;
        const empty = bal === 0;
        const bg    = empty ? (isDarkMode ? "#450a0a" : "#fef2f2")
                    : low   ? (isDarkMode ? "#451a03" : "#fffbeb")
                    :         (isDarkMode ? "#052e16" : "#f0fdf4");
        const border = empty ? "#fca5a5" : low ? "#fcd34d" : "#86efac";
        const textC  = empty ? "#dc2626"  : low ? "#d97706" : "#16a34a";
        const Icon   = empty || low ? AlertTriangle : ShieldCheck;
        return (
          <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon size={18} color={textC} />
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: textC }}>
                  {empty ? tr("pronunciationCreditsTab.pronunciationCreditBudgetIsEmpty")
                   : low  ? tr("pronunciationCreditsTab.lowBudgetOnlyCreditsRemaining", { bal })
                   :        tr("pronunciationCreditsTab.pronunciationCreditBudgetIsHealthy")}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: textC, opacity: 0.8 }}>
                  {tr("pronunciationCreditsTab.availableTotalAllocatedUsed", { value: bal.toLocaleString(), value2: (budget.totalAllocated ?? 0).toLocaleString(), value3: (budget.used ?? 0).toLocaleString() })}</p>
              </div>
            </div>
            <div style={{ background: textC, color: "#fff", fontWeight: 800, fontSize: 22, borderRadius: 10, padding: "6px 18px" }}>
              {bal.toLocaleString()}
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: col.heading }}>{tr("pronunciationCreditsTab.pronunciationCredits")}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: col.muted }}>{tr("pronunciationCreditsTab.grantPronunciationAnalysisCreditsTo")}</p>
        </div>
        <button onClick={() => { fetchStudents(); fetchBudget(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: `2px solid ${col.border}`, background: col.card, color: col.body, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <RefreshCw size={14} /> {tr("pronunciationCreditsTab.refresh")}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label={tr("pronunciationCreditsTab.activeCredits")}      value={totalCredits}         emoji="🎤" color="var(--a-accent-ink)" bg={'var(--a-accent-soft)'} />
        <StatCard label={tr("pronunciationCreditsTab.totalAnalyses")}      value={totalUsed}            emoji="✨" color="#059669" bg={isDarkMode ? "#0d2318" : "#ecfdf5"} />
        <StatCard label={tr("pronunciationCreditsTab.studentsWCredits")} value={studentsWithCredits}  emoji="👤" color="#2563eb" bg={isDarkMode ? "#0d1a2e" : "#eff6ff"} />
        <StatCard label={tr("pronunciationCreditsTab.lowCredit5")}     value={lowCreditStudents}    emoji="⚠️" color="#d97706" bg={isDarkMode ? "#2a1a06" : "#fffbeb"} />
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 400 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: col.muted }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tr("pronunciationCreditsTab.searchStudents")}
          style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: 10, border: `2px solid ${col.border}`, background: col.input, color: col.heading, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: col.muted }}>
          <RefreshCw size={28} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
          <p style={{ marginTop: 12, fontWeight: 700 }}>{tr("pronunciationCreditsTab.loadingStudents")}</p>
        </div>
      ) : (
        <div style={{ background: col.card, borderRadius: 16, border: `2px solid ${col.border}`, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr auto auto auto", padding: "12px 20px", borderBottom: `2px solid ${col.border}`, fontSize: 11, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.06em", gap: 12 }}>
            <span>{tr("pronunciationCreditsTab.student")}</span><span>{tr("pronunciationCreditsTab.email")}</span>
            <span style={{ textAlign: "center" }}>{tr("pronunciationCreditsTab.creditsLeft")}</span>
            <span style={{ textAlign: "center" }}>{tr("pronunciationCreditsTab.used")}</span>
            <span style={{ textAlign: "center" }}>{tr("pronunciationCreditsTab.action")}</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: col.muted, fontWeight: 700 }}>{tr("pronunciationCreditsTab.noStudentsFound")}</div>
          ) : (
            filtered.map((s, i) => {
              const creditColor = s.credits === 0 ? "#dc2626" : s.credits <= 5 ? "#d97706" : "#059669";
              const creditBg    = s.credits === 0 ? "#fee2e2" : s.credits <= 5 ? "#fef3c7" : "#dcfce7";
              return (
                <div key={s._id} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr auto auto auto", padding: "14px 20px", gap: 12, alignItems: "center", borderBottom: i < filtered.length - 1 ? `1px solid ${col.border}` : "none", background: i % 2 === 0 ? "transparent" : (isDarkMode ? "#ffffff08" : "var(--a-raised)") }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: col.heading }}>{s.firstName} {s.lastName}</div>
                    <div style={{ fontSize: 11, color: col.muted, marginTop: 2 }}>{s.status === "active" ? tr("pronunciationCreditsTab.active") : tr("pronunciationCreditsTab.pending")}</div>
                  </div>
                  <div style={{ fontSize: 13, color: col.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{visibleEmail(s.email) || <span style={{ color: col.muted, fontStyle: "italic" }}>{tr("pronunciationCreditsTab.noLoginManaged")}</span>}</div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 800, color: creditColor, background: creditBg }}>
                      <Mic size={12} />
                      {s.credits}
                    </span>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: col.muted }}>{tr("pronunciationCreditsTab.uses", { totalUsed: s.totalUsed })}</div>
                  <div style={{ textAlign: "center" }}>
                    <button onClick={() => openModal(s)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 10, border: "none", background: "var(--a-accent-grad)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px #f9731630" }}>
                      <Plus size={13} /> {tr("pronunciationCreditsTab.grant")}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Grant Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ background: col.card, borderRadius: 20, padding: "28px 28px 24px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: `2px solid ${col.border}` }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: col.heading }}>{tr("pronunciationCreditsTab.grantPronunciationCredits")}</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: col.muted }}>
              {tr("pronunciationCreditsTab.student2")} <strong style={{ color: col.body }}>{modal.student.firstName} {modal.student.lastName}</strong>
              {tr("pronunciationCreditsTab.balance")} <strong style={{ color: "var(--a-accent-ink)" }}>{tr("pronunciationCreditsTab.credits", { credits: modal.student.credits })}</strong>
            </p>

            {/* Presets */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{tr("pronunciationCreditsTab.quickSelect")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PRESET_AMOUNTS.map(a => (
                  <button key={a} onClick={() => { setAmount(a); setCustomAmt(""); }}
                    style={{ padding: "7px 16px", borderRadius: 10, border: `2px solid ${amount === a && !customAmt ? "var(--a-accent)" : col.border}`, background: amount === a && !customAmt ? "var(--a-accent-soft)" : col.card, color: amount === a && !customAmt ? "var(--a-accent-ink)" : col.body, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{tr("pronunciationCreditsTab.customAmount")}</div>
              <input type="number" value={customAmt} onChange={e => { setCustomAmt(e.target.value); setAmount(0); }}
                placeholder="e.g. 75" min={1} max={10000}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `2px solid ${customAmt ? "var(--a-accent)" : col.border}`, background: col.input, color: col.heading, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            {/* Note */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{tr("pronunciationCreditsTab.noteOptional")}</div>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder={tr("pronunciationCreditsTab.eGPaymentReceived")}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `2px solid ${col.border}`, background: col.input, color: col.heading, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            {/* Summary */}
            <div style={{ background: 'var(--a-accent-soft)', borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: col.body, display: "flex", justifyContent: "space-between" }}>
              <span>{tr("pronunciationCreditsTab.creditsAfterGrant")}</span>
              <strong style={{ color: "var(--a-accent-ink)", fontSize: 15 }}>
                {tr("pronunciationCreditsTab.credits2", { value: modal.student.credits + (customAmt ? parseInt(customAmt) || 0 : amount) })}</strong>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: `2px solid ${col.border}`, background: col.card, color: col.body, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {tr("pronunciationCreditsTab.cancel")}
              </button>
              <button onClick={handleGrant} disabled={!!granting}
                style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: "var(--a-accent-grad)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: granting ? "not-allowed" : "pointer", opacity: granting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Mic size={15} />
                {granting ? tr("pronunciationCreditsTab.granting") : tr("pronunciationCreditsTab.grantCredits", { value: customAmt || amount })}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
