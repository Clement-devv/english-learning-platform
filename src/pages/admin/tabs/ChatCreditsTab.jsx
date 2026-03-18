import { useState, useEffect, useCallback } from "react";
import { Search, Zap, Plus, RefreshCw } from "lucide-react";
import api from "../../../api";
import { getStudents } from "../../../services/studentService";

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

export default function ChatCreditsTab({ isDarkMode }) {
  const col = isDarkMode
    ? { bg: "#0f1117", card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#6b7090", input: "#1a1d2e" }
    : { bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#475569", muted: "#94a3b8", input: "#fff" };

  const [students,   setStudents]   = useState([]);    // [{ _id, firstName, surname, email, credits, totalUsed }]
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [granting,   setGranting]   = useState(null);  // studentId currently being granted
  const [modal,      setModal]      = useState(null);  // { student } or null
  const [amount,     setAmount]     = useState(50);
  const [customAmt,  setCustomAmt]  = useState("");
  const [note,       setNote]       = useState("");
  const [toast,      setToast]      = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const studentData = await getStudents();
      const allStudents = studentData.students || studentData || [];

      // Get credit balances for each (parallel)
      const withCredits = await Promise.all(
        allStudents.map(async (s) => {
          try {
            const { data } = await api.get(`/api/chat/credits/student/${s._id}`);
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

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const openModal = (student) => {
    setModal({ student });
    setAmount(50);
    setCustomAmt("");
    setNote("");
  };

  const handleGrant = async () => {
    const finalAmount = customAmt ? parseInt(customAmt, 10) : amount;
    if (!finalAmount || finalAmount < 1 || finalAmount > 10000) {
      showToast("Enter a valid amount (1–10000)", "error");
      return;
    }

    setGranting(modal.student._id);
    try {
      await api.post("/api/chat/credits/grant", {
        studentId: modal.student._id,
        amount:    finalAmount,
        note:      note.trim() || `Granted by admin`,
      });

      // Update locally
      setStudents(prev => prev.map(s =>
        s._id === modal.student._id
          ? { ...s, credits: s.credits + finalAmount }
          : s
      ));

      showToast(`✅ ${finalAmount} credits granted to ${modal.student.firstName}!`);
      setModal(null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to grant credits", "error");
    } finally {
      setGranting(null);
    }
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return (
      s.firstName?.toLowerCase().includes(q) ||
      s.surname?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  const totalCredits  = students.reduce((sum, s) => sum + (s.credits  || 0), 0);
  const totalUsed     = students.reduce((sum, s) => sum + (s.totalUsed || 0), 0);
  const studentsWithCredits = students.filter(s => s.credits > 0).length;
  const lowCreditStudents   = students.filter(s => s.credits > 0 && s.credits <= 10).length;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          padding: "12px 22px", borderRadius: 14, fontWeight: 700, fontSize: 14,
          background: toast.type === "error" ? "#fee2e2" : "#dcfce7",
          color:      toast.type === "error" ? "#dc2626" : "#16a34a",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: col.heading }}>
            💬 AI Chat Credits
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: col.muted }}>
            Grant conversation credits to students who have paid
          </p>
        </div>
        <button onClick={fetchStudents} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
          borderRadius: 10, border: `2px solid ${col.border}`, background: col.card,
          color: col.body, fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label="Active Credits"     value={totalCredits}          emoji="⚡" color="#7c3aed" bg={isDarkMode ? "#1a1230" : "#f5f3ff"} />
        <StatCard label="Total Messages Sent" value={totalUsed}            emoji="💬" color="#059669" bg={isDarkMode ? "#0d2318" : "#ecfdf5"} />
        <StatCard label="Students w/ Credits" value={studentsWithCredits}  emoji="👤" color="#2563eb" bg={isDarkMode ? "#0d1a2e" : "#eff6ff"} />
        <StatCard label="Low Credit (≤10)"    value={lowCreditStudents}    emoji="⚠️" color="#d97706" bg={isDarkMode ? "#2a1a06" : "#fffbeb"} />
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 400 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: col.muted }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students…"
          style={{
            width: "100%", padding: "10px 12px 10px 38px", borderRadius: 10,
            border: `2px solid ${col.border}`, background: col.input,
            color: col.heading, fontSize: 14, fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: col.muted }}>
          <RefreshCw size={28} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ marginTop: 12, fontWeight: 700 }}>Loading students…</p>
        </div>
      ) : (
        <div style={{ background: col.card, borderRadius: 16, border: `2px solid ${col.border}`, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1.2fr auto auto auto",
            padding: "12px 20px", borderBottom: `2px solid ${col.border}`,
            fontSize: 11, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.06em",
            gap: 12,
          }}>
            <span>Student</span>
            <span>Email</span>
            <span style={{ textAlign: "center" }}>Credits Left</span>
            <span style={{ textAlign: "center" }}>Used</span>
            <span style={{ textAlign: "center" }}>Action</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: col.muted, fontWeight: 700 }}>
              No students found
            </div>
          ) : (
            filtered.map((s, i) => {
              const creditColor = s.credits === 0 ? "#dc2626" : s.credits <= 10 ? "#d97706" : "#059669";
              const creditBg    = s.credits === 0 ? "#fee2e2" : s.credits <= 10 ? "#fef3c7" : "#dcfce7";
              return (
                <div key={s._id} style={{
                  display: "grid", gridTemplateColumns: "1fr 1.2fr auto auto auto",
                  padding: "14px 20px", gap: 12, alignItems: "center",
                  borderBottom: i < filtered.length - 1 ? `1px solid ${col.border}` : "none",
                  background: i % 2 === 0 ? "transparent" : (isDarkMode ? "#ffffff08" : "#f8fafc"),
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: col.heading }}>
                      {s.firstName} {s.surname}
                    </div>
                    <div style={{ fontSize: 11, color: col.muted, marginTop: 2 }}>
                      {s.status === "active" ? "✅ Active" : "⏳ Pending"}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: col.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.email}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 800,
                      color: creditColor, background: creditBg,
                    }}>
                      <Zap size={12} fill={creditColor} />
                      {s.credits}
                    </span>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: col.muted }}>
                    {s.totalUsed} msgs
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <button onClick={() => openModal(s)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "7px 16px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        boxShadow: "0 2px 8px #7c3aed30",
                      }}>
                      <Plus size={13} /> Grant
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
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{
            background: col.card, borderRadius: 20, padding: "28px 28px 24px",
            width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            border: `2px solid ${col.border}`,
          }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: col.heading }}>
              ⚡ Grant Chat Credits
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: col.muted }}>
              Student: <strong style={{ color: col.body }}>{modal.student.firstName} {modal.student.surname}</strong>
              &nbsp;· Current balance: <strong style={{ color: "#7c3aed" }}>{modal.student.credits} credits</strong>
            </p>

            {/* Preset amounts */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Quick select
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PRESET_AMOUNTS.map(a => (
                  <button key={a} onClick={() => { setAmount(a); setCustomAmt(""); }}
                    style={{
                      padding: "7px 16px", borderRadius: 10, border: `2px solid ${amount === a && !customAmt ? "#7c3aed" : col.border}`,
                      background: amount === a && !customAmt ? "#f5f3ff" : col.card,
                      color: amount === a && !customAmt ? "#7c3aed" : col.body,
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Custom amount
              </div>
              <input
                type="number"
                value={customAmt}
                onChange={e => { setCustomAmt(e.target.value); setAmount(0); }}
                placeholder="e.g. 75"
                min={1} max={10000}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `2px solid ${customAmt ? "#7c3aed" : col.border}`,
                  background: col.input, color: col.heading, fontSize: 14,
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Note */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Note (optional)
              </div>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Payment received 17 Mar"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `2px solid ${col.border}`, background: col.input,
                  color: col.heading, fontSize: 14, fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Summary */}
            <div style={{
              background: isDarkMode ? "#1f2235" : "#f5f3ff",
              borderRadius: 12, padding: "12px 16px", marginBottom: 20,
              fontSize: 13, color: col.body, display: "flex", justifyContent: "space-between",
            }}>
              <span>Credits after grant:</span>
              <strong style={{ color: "#7c3aed", fontSize: 15 }}>
                {modal.student.credits + (customAmt ? parseInt(customAmt) || 0 : amount)} credits
              </strong>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal(null)}
                style={{
                  flex: 1, padding: "11px", borderRadius: 12,
                  border: `2px solid ${col.border}`, background: col.card,
                  color: col.body, fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}>
                Cancel
              </button>
              <button
                onClick={handleGrant}
                disabled={!!granting}
                style={{
                  flex: 2, padding: "11px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff",
                  fontWeight: 800, fontSize: 14, cursor: granting ? "not-allowed" : "pointer",
                  opacity: granting ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                <Zap size={15} fill="#fff" />
                {granting ? "Granting…" : `Grant ${customAmt || amount} Credits`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
