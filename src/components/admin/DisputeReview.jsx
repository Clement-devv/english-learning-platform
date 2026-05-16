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

  // ── Classroom complaints state ──────────────────────────────────────────────
  const [complaints, setComplaints] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("pending");
  const [expanded,   setExpanded]   = useState(null);
  const [reviewing,  setReviewing]  = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [completing, setCompleting] = useState(false);

  // ── Teacher disputes state ──────────────────────────────────────────────────
  const [teacherDisputes,   setTeacherDisputes]   = useState([]);
  const [disputeLoading,    setDisputeLoading]    = useState(true);
  const [expandedDispute,   setExpandedDispute]   = useState(null);
  const [resolvingId,       setResolvingId]       = useState(null); // booking id being actioned
  const [resolveNotes,      setResolveNotes]      = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/classroom/complaints${filter !== "all" ? `?status=${filter}` : ""}`);
      setComplaints(data.complaints || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const loadDisputes = async () => {
    setDisputeLoading(true);
    try {
      const { data } = await api.get("/disputes");
      setTeacherDisputes(data.disputes || []);
    } catch { /* silent */ }
    finally { setDisputeLoading(false); }
  };

  const refreshAll = () => { load(); loadDisputes(); };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line
  useEffect(() => { loadDisputes(); }, []);

  const updateComplaint = async (id, status, resolution, notes) => {
    try {
      await api.patch(`/classroom/complaints/${id}`, { status, resolution, adminNotes: notes });
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
      await api.patch(`/classroom/admin-complete/${complaint.bookingId?._id || complaint.bookingId}`, {
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

  const resolveDispute = async (bookingId, resolution) => {
    setResolveSubmitting(true);
    try {
      await api.patch(`/disputes/${bookingId}/resolve`, { resolution, adminNotes: resolveNotes });
      await loadDisputes();
      setExpandedDispute(null);
      setResolvingId(null);
      setResolveNotes("");
    } catch (err) {
      alert(err?.response?.data?.message || "Error resolving dispute");
    } finally {
      setResolveSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: "var(--font-body)", color: col.text }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: col.heading }}>Class Disputes</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: col.muted }}>Review incomplete class reports and approve or reject disputes</p>
        </div>
        <button onClick={refreshAll} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: isDarkMode ? "#1e2235" : "#f3f0ff", border: `1px solid ${col.border}`, borderRadius: "10px", cursor: "pointer", color: col.heading, fontSize: "13px", fontWeight: "700" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── SECTION 1: Teacher Disputes ───────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <div style={{ width: "4px", height: "20px", borderRadius: "2px", background: "#f59e0b" }} />
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: col.heading }}>Teacher Disputes</h3>
          {teacherDisputes.length > 0 && (
            <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", background: "#fef3c7", color: "#92400e" }}>
              {teacherDisputes.length} pending
            </span>
          )}
        </div>

        {disputeLoading ? (
          <div style={{ textAlign: "center", padding: "24px", color: col.muted }}>Loading teacher disputes…</div>
        ) : teacherDisputes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 24px", background: col.card, borderRadius: "16px", border: `1px solid ${col.border}` }}>
            <p style={{ fontSize: "28px", margin: "0 0 8px" }}>✅</p>
            <p style={{ margin: 0, fontWeight: "700", color: col.heading, fontSize: "14px" }}>No pending teacher disputes</p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: col.muted }}>Teachers have not raised any disputes currently.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {teacherDisputes.map((d) => {
              const isOpen = expandedDispute === d._id;
              const isActioning = resolvingId === d._id;
              const classType = d.adminRejected ? "Admin Rejected" : d.status === "missed" ? "Missed" : d.status;
              return (
                <div key={d._id} style={{ background: col.card, border: `2px solid #fcd34d`, borderRadius: "14px", overflow: "hidden" }}>
                  {/* Summary row */}
                  <div
                    onClick={() => setExpandedDispute(isOpen ? null : d._id)}
                    style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <AlertTriangle size={18} color="#f59e0b" />
                    </div>
                    <div style={{ flex: 1, minWidth: "160px" }}>
                      <p style={{ margin: 0, fontWeight: "800", fontSize: "14px", color: col.heading }}>
                        {d.classTitle || "Unknown Class"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: col.muted }}>
                        {d.teacherId ? `${d.teacherId.firstName} ${d.teacherId.lastName}` : "?"} &nbsp;→&nbsp;
                        {d.studentId ? `${d.studentId.firstName} ${d.studentId.lastName}` : "?"}
                      </p>
                    </div>
                    <span style={{ flexShrink: 0, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e" }}>
                      {classType}
                    </span>
                    <div style={{ flexShrink: 0, fontSize: "12px", color: col.muted }}>
                      {d.disputedAt ? new Date(d.disputedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </div>
                    {isOpen ? <ChevronUp size={16} color={col.muted} /> : <ChevronDown size={16} color={col.muted} />}
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop: `1px solid #fcd34d`, padding: "14px 18px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                        {[
                          { label: "Teacher", val: d.teacherId ? `${d.teacherId.firstName} ${d.teacherId.lastName}` : "—" },
                          { label: "Student", val: d.studentId ? `${d.studentId.firstName} ${d.studentId.lastName}` : "—" },
                          { label: "Class Status", val: classType },
                          { label: "Disputed By", val: d.disputedBy || "Teacher" },
                          { label: "Disputed At", val: d.disputedAt ? new Date(d.disputedAt).toLocaleString() : "—" },
                          { label: "Scheduled", val: d.scheduledTime ? new Date(d.scheduledTime).toLocaleString() : "—" },
                        ].map(({ label, val }) => (
                          <div key={label} style={{ background: isDarkMode ? "#141620" : "#fffbeb", borderRadius: "8px", padding: "8px 10px" }}>
                            <p style={{ margin: 0, fontSize: "10px", fontWeight: "700", color: col.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
                            <p style={{ margin: "3px 0 0", fontSize: "13px", fontWeight: "600", color: col.heading }}>{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Dispute reason */}
                      <div style={{ background: isDarkMode ? "#1c1a10" : "#fffbeb", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px", border: "1px solid #fcd34d" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#92400e", textTransform: "uppercase" }}>Dispute Reason</p>
                        <p style={{ margin: 0, fontSize: "13px", color: col.text, lineHeight: 1.6 }}>{d.disputeReason || "No reason provided"}</p>
                      </div>

                      {/* What resolution means */}
                      <div style={{ background: isDarkMode ? "#141620" : "#f9fafb", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px", fontSize: "12px", color: col.muted, lineHeight: 1.7 }}>
                        <strong style={{ color: col.heading }}>Approve Teacher</strong> — class marked complete; teacher gets paid; student loses 1 class credit.<br />
                        <strong style={{ color: col.heading }}>Approve Student</strong> — class stays rejected/missed; {d.adminRejected ? "student's class credit is restored." : "no change to student credits."}
                      </div>

                      {/* Resolve actions */}
                      {!isActioning ? (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            onClick={() => { setResolvingId(d._id); setResolveNotes(""); }}
                            style={{ padding: "8px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                            Resolve Dispute
                          </button>
                        </div>
                      ) : (
                        <div style={{ border: "2px solid #f59e0b", borderRadius: "12px", padding: "14px" }}>
                          <p style={{ margin: "0 0 8px", fontWeight: "700", fontSize: "13px", color: col.heading }}>Admin Notes (optional)</p>
                          <textarea
                            value={resolveNotes}
                            onChange={(e) => setResolveNotes(e.target.value)}
                            placeholder="Add notes about your decision..."
                            rows={2}
                            style={{ width: "100%", border: `1px solid ${col.border}`, borderRadius: "8px", padding: "8px 10px", fontSize: "13px", resize: "none", background: col.card, color: col.text, marginBottom: "10px", boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              onClick={() => resolveDispute(d._id, "approve_teacher")}
                              disabled={resolveSubmitting}
                              style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "700", opacity: resolveSubmitting ? 0.6 : 1 }}>
                              {resolveSubmitting ? "Processing…" : "✓ Approve Teacher"}
                            </button>
                            <button
                              onClick={() => resolveDispute(d._id, "approve_student")}
                              disabled={resolveSubmitting}
                              style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "700", opacity: resolveSubmitting ? 0.6 : 1 }}>
                              {resolveSubmitting ? "Processing…" : "✗ Approve Student"}
                            </button>
                            <button
                              onClick={() => { setResolvingId(null); setResolveNotes(""); }}
                              style={{ padding: "8px 16px", background: isDarkMode ? "#1e2235" : "#f3f0ff", color: col.heading, border: `1px solid ${col.border}`, borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                              Cancel
                            </button>
                          </div>
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

      {/* ── SECTION 2: Classroom Complaints ──────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <div style={{ width: "4px", height: "20px", borderRadius: "2px", background: "#7c3aed" }} />
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: col.heading }}>Classroom Complaints</h3>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {["pending", "under_review", "approved", "rejected", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "6px 14px", borderRadius: "20px", border: `2px solid ${filter === f ? "#7c3aed" : col.border}`, background: filter === f ? "#7c3aed" : col.card, color: filter === f ? "#fff" : col.text, fontSize: "12px", fontWeight: "700", cursor: "pointer", textTransform: "capitalize" }}>
              {f === "all" ? "All" : STATUS_COLORS[f]?.label || f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: col.muted }}>Loading complaints…</div>
        ) : complaints.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: col.card, borderRadius: "20px", border: `1px solid ${col.border}` }}>
            <p style={{ fontSize: "40px", margin: "0 0 12px" }}>✅</p>
            <p style={{ margin: 0, fontWeight: "700", color: col.heading }}>No complaints found</p>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: col.muted }}>No {filter !== "all" ? filter : ""} classroom complaints at this time.</p>
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
                        {c.studentId ? `${c.studentId.firstName} ${c.studentId.lastName}` : "?"}
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
    </div>
  );
}
