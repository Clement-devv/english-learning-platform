// src/components/admin/DisputeReview.jsx
import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import api from "../../api";

const STATUS_COLORS = {
  pending:      { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", label: "Pending" },
  under_review: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", label: "Under Review" },
  approved:     { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", label: "Approved" },
  rejected:     { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", label: "Rejected" },
};

const REASON_LABELS = {
  network_issue:           "Network / Technical Issue",
  emergency:               "Emergency",
  student_absent:          "Student Was Absent",
  student_unprepared:      "Student Was Unprepared",
  insufficient_attendance: "Attendance Tracker Error",
  other:                   "Other",
};

function fmt(seconds) {
  if (!seconds) return "0m";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function DisputeReview({ isDarkMode }) {
  const col = isDarkMode
    ? { bg: "#0f1117", card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", text: "#c8cce0", muted: "#6b7090" }
    : { bg: "#f8faff", card: "#ffffff", border: "#e5e7f0", heading: "#1e1b4b", text: "#374151", muted: "#9ca3af" };

  const [complaints, setComplaints] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("pending");
  const [expanded,   setExpanded]   = useState(null);
  const [reviewing,  setReviewing]  = useState(null); // complaint id being actioned
  const [adminNotes, setAdminNotes] = useState("");
  const [completing, setCompleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/classroom/complaints${filter !== "all" ? `?status=${filter}` : ""}`);
      setComplaints(data.complaints || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  const updateComplaint = async (id, status, resolution, notes) => {
    try {
      await api.patch(`/api/classroom/complaints/${id}`, { status, resolution, adminNotes: notes });
      await load();
      setReviewing(null);
      setAdminNotes("");
    } catch (err) {
      console.error("Update complaint error:", err);
    }
  };

  const markCompleted = async (complaint) => {
    setCompleting(true);
    try {
      await api.patch(`/api/classroom/admin-complete/${complaint.bookingId?._id || complaint.bookingId}`, {
        complaintId: complaint._id,
        adminNotes: adminNotes || "Marked complete by admin after dispute review",
      });
      await load();
      setReviewing(null);
      setAdminNotes("");
    } catch (err) {
      console.error("Admin complete error:", err);
      alert(err?.response?.data?.message || "Error marking complete");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: col.text }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: col.heading }}>Class Disputes</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: col.muted }}>Review incomplete class reports and approve or reject disputes</p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: isDarkMode ? "#1e2235" : "#f3f0ff", border: `1px solid ${col.border}`, borderRadius: "10px", cursor: "pointer", color: col.heading, fontSize: "13px", fontWeight: "700" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {["pending", "under_review", "approved", "rejected", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "7px 16px", borderRadius: "20px", border: `2px solid ${filter === f ? "#7c3aed" : col.border}`, background: filter === f ? "#7c3aed" : col.card, color: filter === f ? "#fff" : col.text, fontSize: "12px", fontWeight: "700", cursor: "pointer", textTransform: "capitalize" }}>
            {f === "all" ? "All" : STATUS_COLORS[f]?.label || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: col.muted }}>Loading disputes…</div>
      ) : complaints.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", background: col.card, borderRadius: "20px", border: `1px solid ${col.border}` }}>
          <p style={{ fontSize: "40px", margin: "0 0 12px" }}>✅</p>
          <p style={{ margin: 0, fontWeight: "700", color: col.heading }}>No disputes found</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>No {filter !== "all" ? filter : ""} disputes at this time.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {complaints.map(c => {
            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.pending;
            const isOpen = expanded === c._id;
            const isActioning = reviewing === c._id;
            const booking = c.bookingId;
            return (
              <div key={c._id} style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "16px", overflow: "hidden" }}>
                {/* Summary row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : c._id)}
                  style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <AlertTriangle size={20} color="#f59e0b" />
                  </div>
                  <div style={{ flex: 1, minWidth: "180px" }}>
                    <p style={{ margin: 0, fontWeight: "800", fontSize: "14px", color: col.heading }}>
                      {booking?.classTitle || "Unknown Class"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: col.muted }}>
                      {c.teacherId ? `${c.teacherId.firstName} ${c.teacherId.lastName}` : "?"} &nbsp;→&nbsp;
                      {c.studentId ? `${c.studentId.firstName} ${c.studentId.surname}` : "?"}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      {sc.label}
                    </span>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: "12px", color: col.muted }}>
                    {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  {isOpen ? <ChevronUp size={16} color={col.muted} /> : <ChevronDown size={16} color={col.muted} />}
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${col.border}`, padding: "16px 20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "14px" }}>
                      {[
                        { label: "Reason",          val: REASON_LABELS[c.reason] || c.reason },
                        { label: "Reported By",     val: c.reportedBy },
                        { label: "Time Together",   val: fmt(c.bothActiveTime) },
                        { label: "Required Time",   val: fmt(c.requiredTime) },
                        { label: "Ended By",        val: c.endedBy },
                        { label: "Ended At",        val: new Date(c.endedAt).toLocaleString() },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background: isDarkMode ? "#141620" : "#f9fafb", borderRadius: "10px", padding: "10px 12px" }}>
                          <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: col.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
                          <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: "600", color: col.heading }}>{val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    <div style={{ background: isDarkMode ? "#141620" : "#f9fafb", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: col.muted, textTransform: "uppercase" }}>Description</p>
                      <p style={{ margin: 0, fontSize: "13px", color: col.text, lineHeight: 1.6 }}>{c.description}</p>
                    </div>

                    {/* Admin notes if already reviewed */}
                    {c.adminNotes && (
                      <div style={{ background: isDarkMode ? "#1a2235" : "#eff6ff", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px", border: `1px solid ${isDarkMode ? "#2a3550" : "#bfdbfe"}` }}>
                        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#1d4ed8", textTransform: "uppercase" }}>Admin Notes</p>
                        <p style={{ margin: 0, fontSize: "13px", color: col.text }}>{c.adminNotes}</p>
                      </div>
                    )}

                    {/* Action buttons for pending/under_review */}
                    {(c.status === "pending" || c.status === "under_review") && (
                      <div>
                        {!isActioning ? (
                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <button onClick={() => { setReviewing(c._id); setAdminNotes(""); }}
                              style={{ padding: "9px 18px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                              Review & Action
                            </button>
                            <button onClick={() => updateComplaint(c._id, "under_review", null, "")}
                              style={{ padding: "9px 18px", background: isDarkMode ? "#1e2235" : "#f3f0ff", color: col.heading, border: `1px solid ${col.border}`, borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                              Mark Under Review
                            </button>
                          </div>
                        ) : (
                          <div style={{ border: `2px solid #7c3aed`, borderRadius: "14px", padding: "16px" }}>
                            <p style={{ margin: "0 0 10px", fontWeight: "700", fontSize: "13px", color: col.heading }}>Admin Notes (optional)</p>
                            <textarea
                              value={adminNotes}
                              onChange={e => setAdminNotes(e.target.value)}
                              placeholder="Add notes about your decision..."
                              rows={2}
                              style={{ width: "100%", border: `1px solid ${col.border}`, borderRadius: "10px", padding: "10px 12px", fontSize: "13px", resize: "none", background: col.card, color: col.text, marginBottom: "12px", boxSizing: "border-box" }}
                            />
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                onClick={() => markCompleted(c)}
                                disabled={completing}
                                style={{ padding: "9px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: "700", opacity: completing ? 0.6 : 1 }}>
                                {completing ? "Processing…" : "✓ Approve & Mark Completed"}
                              </button>
                              <button
                                onClick={() => updateComplaint(c._id, "rejected", "no_action", adminNotes)}
                                style={{ padding: "9px 18px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                                ✗ Reject Dispute
                              </button>
                              <button
                                onClick={() => { setReviewing(null); setAdminNotes(""); }}
                                style={{ padding: "9px 18px", background: isDarkMode ? "#1e2235" : "#f3f0ff", color: col.heading, border: `1px solid ${col.border}`, borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
