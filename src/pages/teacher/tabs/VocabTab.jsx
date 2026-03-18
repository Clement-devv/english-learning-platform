// src/pages/teacher/tabs/VocabTab.jsx
import { useState, useEffect } from "react";
import { Plus, Trash2, Users, BookOpen, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import api from "../../../api";

export default function VocabTab({ teacherInfo, students, isDarkMode }) {
  const [lists,       setLists]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState("lists"); // "lists" | "create" | "assign"
  const [expandedId,  setExpandedId]  = useState(null);
  const [assignTarget,setAssignTarget]= useState(null); // list to assign
  const [selectedStu, setSelectedStu] = useState([]);
  const [toast,       setToast]       = useState("");

  // Create form state
  const [form, setForm] = useState({ title: "", description: "", words: [{ word: "", definition: "", example: "" }] });

  const col = {
    bg:       isDarkMode ? "#0f1117" : "#f8faff",
    card:     isDarkMode ? "#1a1d2e" : "#ffffff",
    border:   isDarkMode ? "#2a2d40" : "#e8edf5",
    text:     isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:    isDarkMode ? "#8b91b8" : "#6b7280",
    input:    isDarkMode ? "#1e2235" : "#f3f4f6",
    accent:   "#6366f1",
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchLists = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/vocab/lists");
      setLists(data.lists || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLists(); }, []);

  // ── Create list ────────────────────────────────────────────────────────────
  const addWord = () => setForm(f => ({ ...f, words: [...f.words, { word: "", definition: "", example: "" }] }));
  const removeWord = (i) => setForm(f => ({ ...f, words: f.words.filter((_, idx) => idx !== i) }));
  const updateWord = (i, field, val) => setForm(f => {
    const w = [...f.words]; w[i] = { ...w[i], [field]: val }; return { ...f, words: w };
  });

  const handleCreate = async () => {
    if (!form.title.trim()) return showToast("Please enter a title");
    const validWords = form.words.filter(w => w.word.trim() && w.definition.trim());
    if (validWords.length === 0) return showToast("Add at least one complete word");
    try {
      await api.post("/api/vocab/lists", { title: form.title, description: form.description, words: validWords });
      showToast("List created!");
      setForm({ title: "", description: "", words: [{ word: "", definition: "", example: "" }] });
      setView("lists");
      fetchLists();
    } catch (e) { showToast(e.response?.data?.message || "Failed to create list"); }
  };

  // ── Delete list ────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm("Delete this word list?")) return;
    try {
      await api.delete(`/api/vocab/lists/${id}`);
      setLists(l => l.filter(x => x._id !== id));
      showToast("List deleted");
    } catch { showToast("Failed to delete"); }
  };

  // ── Assign list ────────────────────────────────────────────────────────────
  const openAssign = (list) => {
    const already = (list.assignedTo || []).map(a => a.studentId?._id || a.studentId);
    setSelectedStu(already);
    setAssignTarget(list);
    setView("assign");
  };

  const handleAssign = async () => {
    try {
      await api.post(`/api/vocab/lists/${assignTarget._id}/assign`, { studentIds: selectedStu });
      showToast("Students assigned!");
      setView("lists");
      fetchLists();
    } catch (e) { showToast(e.response?.data?.message || "Failed to assign"); }
  };

  const toggleStu = (id) => setSelectedStu(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const inp = {
    width: "100%", padding: "10px 14px", borderRadius: "10px",
    border: `1px solid ${col.border}`, background: col.input,
    color: col.text, fontSize: "14px", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  // ── Render: Create ─────────────────────────────────────────────────────────
  if (view === "create") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "700px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => setView("lists")} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px" }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: col.text }}>New Word List</h2>
      </div>

      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: 700, color: col.muted, display: "block", marginBottom: "6px" }}>LIST TITLE *</label>
          <input style={inp} placeholder="e.g. Business English Week 3" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: "12px", fontWeight: 700, color: col.muted, display: "block", marginBottom: "6px" }}>DESCRIPTION (optional)</label>
          <input style={inp} placeholder="What topic does this cover?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>

      {/* Words */}
      <h3 style={{ margin: "4px 0 0", fontSize: "15px", fontWeight: 800, color: col.text }}>Words ({form.words.length})</h3>
      {form.words.map((w, i) => (
        <div key={i} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", position: "relative" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 800, color: col.accent, minWidth: "24px" }}>#{i + 1}</span>
            <input style={{ ...inp, flex: 1 }} placeholder="Word *" value={w.word} onChange={e => updateWord(i, "word", e.target.value)} />
            {form.words.length > 1 && (
              <button onClick={() => removeWord(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}><X size={16} /></button>
            )}
          </div>
          <input style={inp} placeholder="Definition *" value={w.definition} onChange={e => updateWord(i, "definition", e.target.value)} />
          <input style={{ ...inp, color: col.muted }} placeholder="Example sentence (optional)" value={w.example} onChange={e => updateWord(i, "example", e.target.value)} />
        </div>
      ))}

      <button onClick={addWord} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px", border: `2px dashed ${col.border}`, background: "none", color: col.muted, cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>
        <Plus size={16} /> Add Word
      </button>

      <button onClick={handleCreate} style={{ padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: 800 }}>
        Create List
      </button>

      {toast && <div style={{ padding: "12px 16px", background: "#10b981", color: "#fff", borderRadius: "10px", fontWeight: 700 }}>{toast}</div>}
    </div>
  );

  // ── Render: Assign ─────────────────────────────────────────────────────────
  if (view === "assign") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "500px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={() => setView("lists")} style={{ background: "none", border: "none", color: col.muted, cursor: "pointer", fontSize: "14px" }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: col.text }}>Assign: {assignTarget?.title}</h2>
      </div>

      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {students.length === 0
          ? <p style={{ color: col.muted, fontSize: "14px", margin: 0 }}>No students assigned to you yet.</p>
          : students.map(s => {
              const id = s._id || s.id;
              const checked = selectedStu.includes(id);
              return (
                <button key={id} onClick={() => toggleStu(id)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "10px", border: `1.5px solid ${checked ? col.accent : col.border}`, background: checked ? (isDarkMode ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)") : "transparent", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "6px", border: `2px solid ${checked ? col.accent : col.border}`, background: checked ? col.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {checked && <Check size={13} color="#fff" />}
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: col.text }}>{s.firstName} {s.surname || s.lastName}</span>
                </button>
              );
            })
        }
      </div>

      <button onClick={handleAssign} disabled={selectedStu.length === 0} style={{ padding: "12px", borderRadius: "12px", background: selectedStu.length ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : col.border, color: selectedStu.length ? "#fff" : col.muted, border: "none", cursor: selectedStu.length ? "pointer" : "default", fontSize: "15px", fontWeight: 800 }}>
        Assign to {selectedStu.length} student{selectedStu.length !== 1 ? "s" : ""}
      </button>

      {toast && <div style={{ padding: "12px 16px", background: "#10b981", color: "#fff", borderRadius: "10px", fontWeight: 700 }}>{toast}</div>}
    </div>
  );

  // ── Render: Lists ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: col.text }}>📖 Vocabulary Lists</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: col.muted }}>{lists.length} list{lists.length !== 1 ? "s" : ""} created</p>
        </div>
        <button onClick={() => setView("create")} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "12px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 800 }}>
          <Plus size={16} /> New List
        </button>
      </div>

      {loading ? (
        <p style={{ color: col.muted, fontSize: "14px" }}>Loading…</p>
      ) : lists.length === 0 ? (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "16px", padding: "40px", textAlign: "center" }}>
          <p style={{ fontSize: "40px", margin: "0 0 12px" }}>📖</p>
          <p style={{ color: col.muted, fontWeight: 700, margin: 0 }}>No word lists yet. Create your first one!</p>
        </div>
      ) : (
        lists.map(list => {
          const isOpen = expandedId === list._id;
          const assignedCount = (list.assignedTo || []).length;
          return (
            <div key={list._id} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px" }}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedId(isOpen ? null : list._id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: col.text }}>{list.title}</span>
                    {isOpen ? <ChevronUp size={16} color={col.muted} /> : <ChevronDown size={16} color={col.muted} />}
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                    <span style={{ fontSize: "12px", color: col.muted }}>📝 {list.words?.length || 0} words</span>
                    <span style={{ fontSize: "12px", color: assignedCount ? col.accent : col.muted }}>👥 {assignedCount} student{assignedCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <button onClick={() => openAssign(list)} title="Assign to students" style={{ padding: "8px 14px", borderRadius: "10px", border: `1px solid ${col.border}`, background: "none", color: col.accent, cursor: "pointer", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Users size={14} /> Assign
                </button>
                <button onClick={() => handleDelete(list._id)} title="Delete list" style={{ padding: "8px", borderRadius: "10px", border: "none", background: "none", color: "#ef4444", cursor: "pointer" }}>
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Expanded words */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${col.border}`, padding: "12px 20px 16px" }}>
                  {list.description && <p style={{ margin: "0 0 12px", fontSize: "13px", color: col.muted, fontStyle: "italic" }}>{list.description}</p>}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(list.words || []).map((w, i) => (
                      <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 14px", background: isDarkMode ? "rgba(255,255,255,0.04)" : "#f8faff", borderRadius: "10px" }}>
                        <span style={{ fontWeight: 800, color: col.accent, minWidth: "80px", fontSize: "14px" }}>{w.word}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "13px", color: col.text, fontWeight: 600 }}>{w.definition}</p>
                          {w.example && <p style={{ margin: "2px 0 0", fontSize: "12px", color: col.muted, fontStyle: "italic" }}>"{w.example}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Assigned students */}
                  {assignedCount > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 800, color: col.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Assigned to</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {list.assignedTo.map(a => {
                          const s = a.studentId;
                          if (!s) return null;
                          return (
                            <span key={s._id} style={{ padding: "4px 10px", borderRadius: "20px", background: isDarkMode ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)", color: col.accent, fontSize: "12px", fontWeight: 700 }}>
                              {s.firstName} {s.surname}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", padding: "12px 20px", background: "#10b981", color: "#fff", borderRadius: "12px", fontWeight: 700, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
