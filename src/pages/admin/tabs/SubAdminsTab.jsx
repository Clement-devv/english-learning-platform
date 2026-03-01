// src/pages/admin/tabs/SubAdminsTab.jsx
import React, { useState, useEffect } from "react";
import {
  Plus, Users, Shield, Mail, RefreshCw, Trash2, Edit2,
  ChevronDown, ChevronUp, CheckCircle, XCircle, Clock,
  Send, ToggleLeft, ToggleRight, Search, UserCheck, Globe
} from "lucide-react";
import api from "../../../api";

export default function SubAdminsTab({ isDarkMode, teachers = [] }) {
  const [subAdmins, setSubAdmins]         = useState([]);
  const [allTeachers, setAllTeachers]     = useState(teachers);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [editTarget, setEditTarget]       = useState(null); // subAdmin being edited
  const [expandedId, setExpandedId]       = useState(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast]                 = useState({ msg: "", type: "" });

  const c = palette(isDarkMode);

  // ── form state ──────────────────────────────────────────────────────────
  const blankForm = {
    firstName: "", lastName: "", email: "",
    assignmentType: "manual",
    region: "africa",
    assignedTeachers: [],
    notes: "",
    permissions: {
      canMarkLessons:  false,
      canViewPayments: false,
      canSendMessages: true,
      canViewBookings: true,
      canViewClasses:  true,
    },
  };
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    fetchSubAdmins();
    if (allTeachers.length === 0) fetchTeachers();
  }, []);

  const fetchSubAdmins = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/sub-admins");
      setSubAdmins(res.data.subAdmins || []);
    } catch (e) {
      showToast("Failed to load sub-admins", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await api.get("/api/teachers");
      setAllTeachers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to fetch teachers:", e);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 4000);
  };

  const setAction = (id, val) => setActionLoading((p) => ({ ...p, [id]: val }));

  // ── submit (create or update) ────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setAction("form", true);
      if (editTarget) {
        await api.put(`/api/sub-admins/${editTarget._id}`, form);
        showToast("Sub-admin updated successfully");
      } else {
        await api.post("/api/sub-admins/invite", form);
        showToast(`Invitation sent to ${form.email} ✉️`);
      }
      setShowForm(false);
      setEditTarget(null);
      setForm(blankForm);
      fetchSubAdmins();
    } catch (e) {
      showToast(e.response?.data?.message || "Action failed", "error");
    } finally {
      setAction("form", false);
    }
  };

  const openEdit = (sa) => {
    setEditTarget(sa);
    setForm({
      firstName: sa.firstName,
      lastName:  sa.lastName,
      email:     sa.email,
      assignmentType:   sa.assignmentType,
      region:           sa.region || "africa",
      assignedTeachers: sa.assignedTeachers?.map((t) => t._id || t) || [],
      notes:            sa.notes || "",
      permissions:      sa.permissions || blankForm.permissions,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResendInvite = async (sa) => {
    setAction(sa._id + "_resend", true);
    try {
      await api.post(`/api/sub-admins/${sa._id}/resend-invite`);
      showToast("Invitation resent ✉️");
    } catch (e) {
      showToast("Failed to resend", "error");
    } finally {
      setAction(sa._id + "_resend", false);
    }
  };

  const handleToggleStatus = async (sa) => {
    setAction(sa._id + "_toggle", true);
    try {
      const res = await api.patch(`/api/sub-admins/${sa._id}/toggle-status`);
      showToast(`Sub-admin ${res.data.status === "active" ? "reactivated" : "suspended"}`);
      fetchSubAdmins();
    } catch (e) {
      showToast("Failed to toggle status", "error");
    } finally {
      setAction(sa._id + "_toggle", false);
    }
  };

  const handleDelete = async (sa) => {
    if (!confirm(`Delete ${sa.firstName} ${sa.lastName}? This cannot be undone.`)) return;
    setAction(sa._id + "_delete", true);
    try {
      await api.delete(`/api/sub-admins/${sa._id}`);
      showToast("Sub-admin deleted");
      fetchSubAdmins();
    } catch (e) {
      showToast("Failed to delete", "error");
    } finally {
      setAction(sa._id + "_delete", false);
    }
  };

  const toggleTeacher = (id) => {
    setForm((p) => ({
      ...p,
      assignedTeachers: p.assignedTeachers.includes(id)
        ? p.assignedTeachers.filter((t) => t !== id)
        : [...p.assignedTeachers, id],
    }));
  };

  const togglePerm = (key) => {
    setForm((p) => ({
      ...p,
      permissions: { ...p.permissions, [key]: !p.permissions[key] },
    }));
  };

  const filtered = subAdmins.filter(
    (sa) =>
      `${sa.firstName} ${sa.lastName} ${sa.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusBadge = (status) => {
    const map = {
      active:    { color: "#10b981", bg: isDarkMode ? "rgba(16,185,129,0.12)" : "#d1fae5", label: "Active",    icon: CheckCircle },
      pending:   { color: "#f59e0b", bg: isDarkMode ? "rgba(245,158,11,0.12)" : "#fef9c3", label: "Pending",   icon: Clock       },
      suspended: { color: "#ef4444", bg: isDarkMode ? "rgba(239,68,68,0.12)" : "#fee2e2",  label: "Suspended", icon: XCircle     },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        background: cfg.bg, color: cfg.color,
        padding: "3px 10px", borderRadius: "20px",
        fontSize: "12px", fontWeight: "700",
      }}>
        <Icon size={11} />
        {cfg.label}
      </span>
    );
  };

  const REGIONS = ["africa", "asia", "europe", "americas", "oceania"];
  const PERMS = [
    { key: "canMarkLessons",  label: "Mark Lessons",   desc: "Can mark/unmark lessons as completed" },
    { key: "canViewPayments", label: "View Payments",  desc: "Can see teacher payment records" },
    { key: "canSendMessages", label: "Send Messages",  desc: "Can message teachers and students" },
    { key: "canViewBookings", label: "View Bookings",  desc: "Can see class bookings" },
    { key: "canViewClasses",  label: "View Classes",   desc: "Can see class details" },
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Toast ── */}
      {toast.msg && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 200,
          background: toast.type === "error" ? "#ef4444" : "#10b981",
          color: "white", padding: "12px 20px", borderRadius: "12px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: c.heading }}>
            Sub-Admins
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: c.muted }}>
            Invite and manage team members with scoped access
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditTarget(null); setForm(blankForm); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: showForm ? (isDarkMode ? "#1e2235" : "#eef1ff") : "linear-gradient(135deg, #4f63d2, #6b82f0)",
            color: showForm ? c.heading : "white",
            border: "none", borderRadius: "12px", padding: "10px 18px",
            fontSize: "14px", fontWeight: "700", cursor: "pointer",
            boxShadow: showForm ? "none" : "0 4px 16px rgba(107,130,240,0.35)",
          }}
        >
          <Plus size={16} />
          {showForm ? "Cancel" : "Invite Sub-Admin"}
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div style={{
          background: c.card, border: `1px solid ${c.border}`,
          borderRadius: "16px", padding: "28px",
        }}>
          <h2 style={{ margin: "0 0 24px", fontSize: "17px", fontWeight: "800", color: c.heading }}>
            {editTarget ? "Edit Sub-Admin" : "Invite New Sub-Admin"}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Name row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              {["firstName", "lastName"].map((field) => (
                <div key={field}>
                  <label style={s.label(isDarkMode)}>{field === "firstName" ? "First Name" : "Last Name"} *</label>
                  <input
                    value={form[field]}
                    onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                    required
                    placeholder={field === "firstName" ? "John" : "Smith"}
                    style={s.input(isDarkMode)}
                  />
                </div>
              ))}
            </div>

            {/* Email */}
            {!editTarget && (
              <div>
                <label style={s.label(isDarkMode)}>Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="john@company.com"
                  style={s.input(isDarkMode)}
                />
              </div>
            )}

            {/* Assignment type */}
            <div>
              <label style={s.label(isDarkMode)}>Assignment Type</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {["manual", "region"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, assignmentType: type }))}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
                      background: form.assignmentType === type
                        ? "linear-gradient(135deg, #4f63d2, #6b82f0)"
                        : (isDarkMode ? "#1e2235" : "#f0f4ff"),
                      color: form.assignmentType === type ? "white" : c.text,
                      fontFamily: "inherit", fontSize: "13.5px", fontWeight: "700",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    }}
                  >
                    {type === "manual" ? <Users size={15} /> : <Globe size={15} />}
                    {type === "manual" ? "Manual (pick teachers)" : "By Region (auto)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Region picker */}
            {form.assignmentType === "region" && (
              <div>
                <label style={s.label(isDarkMode)}>Region</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, region: r }))}
                      style={{
                        padding: "8px 16px", borderRadius: "20px", border: "none", cursor: "pointer",
                        background: form.region === r
                          ? "linear-gradient(135deg, #4f63d2, #6b82f0)"
                          : (isDarkMode ? "#1e2235" : "#f0f4ff"),
                        color: form.region === r ? "white" : c.text,
                        fontFamily: "inherit", fontSize: "13px", fontWeight: "700",
                        textTransform: "capitalize",
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Teacher picker */}
            {form.assignmentType === "manual" && (
              <div>
                <label style={s.label(isDarkMode)}>
                  Assign Teachers ({form.assignedTeachers.length} selected)
                </label>
                <div style={{
                  border: `1.5px solid ${c.border}`, borderRadius: "12px",
                  maxHeight: "200px", overflowY: "auto", padding: "8px",
                  background: isDarkMode ? "#0f1117" : "#f8faff",
                }} className="sa-scroll">
                  {allTeachers.length === 0 ? (
                    <p style={{ padding: "12px", fontSize: "13px", color: c.muted, textAlign: "center" }}>
                      No teachers available
                    </p>
                  ) : (
                    allTeachers.map((t) => {
                      const id = t._id;
                      const selected = form.assignedTeachers.includes(id);
                      return (
                        <div
                          key={id}
                          onClick={() => toggleTeacher(id)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "8px 10px", borderRadius: "8px", cursor: "pointer",
                            background: selected ? (isDarkMode ? "#1e2540" : "#eef1ff") : "transparent",
                            marginBottom: "2px",
                          }}
                        >
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "5px", flexShrink: 0,
                            background: selected ? "#6b82f0" : "transparent",
                            border: `2px solid ${selected ? "#6b82f0" : c.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {selected && <CheckCircle size={12} color="white" />}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "600", color: c.heading }}>
                              {t.firstName} {t.lastName}
                            </p>
                            <p style={{ margin: 0, fontSize: "11.5px", color: c.muted }}>
                              {t.email} {t.continent ? `· ${t.continent}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Permissions */}
            <div>
              <label style={s.label(isDarkMode)}>Permissions</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {PERMS.map(({ key, label, desc }) => (
                  <div
                    key={key}
                    onClick={() => togglePerm(key)}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "12px", borderRadius: "10px", cursor: "pointer",
                      background: form.permissions[key]
                        ? (isDarkMode ? "#1e2540" : "#eef1ff")
                        : (isDarkMode ? "#0f1117" : "#f8faff"),
                      border: `1.5px solid ${form.permissions[key] ? "#6b82f0" : c.border}`,
                    }}
                  >
                    <div style={{
                      width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0,
                      background: form.permissions[key] ? "#6b82f0" : "transparent",
                      border: `2px solid ${form.permissions[key] ? "#6b82f0" : c.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {form.permissions[key] && <CheckCircle size={13} color="white" />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: c.heading }}>{label}</p>
                      <p style={{ margin: 0, fontSize: "11px", color: c.muted }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={s.label(isDarkMode)}>Internal Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Manages Nigeria teachers, 9am-5pm WAT"
                rows={2}
                style={{ ...s.input(isDarkMode), resize: "vertical", minHeight: "64px", lineHeight: "1.5" }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={actionLoading["form"]}
              style={{
                background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
                color: "white", border: "none", borderRadius: "12px",
                padding: "14px", fontSize: "15px", fontWeight: "700",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(107,130,240,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {actionLoading["form"] ? (
                <><span className="sa-spin" style={{ width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} /> Processing…</>
              ) : editTarget ? (
                <><Edit2 size={16} /> Save Changes</>
              ) : (
                <><Send size={16} /> Send Invitation Email</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── Search ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        background: isDarkMode ? "#1a1d2e" : "#f0f4ff",
        border: `1.5px solid ${c.border}`, borderRadius: "12px", padding: "0 14px",
      }}>
        <Search size={15} color={c.muted} />
        <input
          type="text"
          placeholder="Search sub-admins…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            padding: "12px 0", fontSize: "13.5px", color: c.heading, fontFamily: "inherit",
          }}
        />
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {[
          { label: "Total",     value: subAdmins.length,                                    color: "#6b82f0" },
          { label: "Active",    value: subAdmins.filter((s) => s.status === "active").length,  color: "#10b981" },
          { label: "Pending",   value: subAdmins.filter((s) => s.status === "pending").length, color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: c.card, border: `1px solid ${c.border}`,
            borderRadius: "14px", padding: "16px 20px",
            display: "flex", alignItems: "center", gap: "12px",
          }}>
            <p style={{ margin: 0, fontSize: "26px", fontWeight: "800", color }}>{value}</p>
            <p style={{ margin: 0, fontSize: "13px", color: c.muted, fontWeight: "600" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="sa-spin" style={{ width: "32px", height: "32px", border: `3px solid ${c.border}`, borderTopColor: "#6b82f0", borderRadius: "50%", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "13px", color: c.muted }}>Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Shield size={40} color={isDarkMode ? "#1e2235" : "#e2e8f0"} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: "15px", fontWeight: "600", color: c.muted, margin: "0 0 6px" }}>
            {searchQuery ? "No results found" : "No sub-admins yet"}
          </p>
          <p style={{ fontSize: "13px", color: isDarkMode ? "#252840" : "#d0d5ea", margin: 0 }}>
            {searchQuery ? "Try a different search" : 'Click "Invite Sub-Admin" to get started'}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((sa) => {
            const isExpanded = expandedId === sa._id;
            return (
              <div key={sa._id} style={{
                background: c.card, border: `1px solid ${c.border}`,
                borderRadius: "16px", overflow: "hidden",
                transition: "box-shadow 0.15s",
              }}>
                {/* Row header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "16px 20px", cursor: "pointer",
                }}
                  onClick={() => setExpandedId(isExpanded ? null : sa._id)}
                >
                  {/* Avatar */}
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "13px", flexShrink: 0,
                    background: "linear-gradient(135deg, #4f63d2, #6b82f0)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "15px", fontWeight: "800", color: "white",
                    boxShadow: "0 4px 12px rgba(107,130,240,0.3)",
                  }}>
                    {sa.firstName[0]}{sa.lastName[0]}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "15px", fontWeight: "700", color: c.heading }}>
                        {sa.firstName} {sa.lastName}
                      </span>
                      {statusBadge(sa.status)}
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: c.muted }}>
                      {sa.email} · {sa.assignmentType === "region" ? `Region: ${sa.region}` : `${sa.assignedTeachers?.length || 0} teacher(s) assigned`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sa.status === "pending" && (
                      <ActionBtn
                        onClick={() => handleResendInvite(sa)}
                        loading={actionLoading[sa._id + "_resend"]}
                        title="Resend invite"
                        color="#6b82f0"
                        isDarkMode={isDarkMode}
                      >
                        <Send size={14} />
                      </ActionBtn>
                    )}
                    {sa.status !== "pending" && (
                      <ActionBtn
                        onClick={() => handleToggleStatus(sa)}
                        loading={actionLoading[sa._id + "_toggle"]}
                        title={sa.status === "active" ? "Suspend" : "Reactivate"}
                        color={sa.status === "active" ? "#f59e0b" : "#10b981"}
                        isDarkMode={isDarkMode}
                      >
                        {sa.status === "active" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </ActionBtn>
                    )}
                    <ActionBtn
                      onClick={() => openEdit(sa)}
                      title="Edit"
                      color="#3b82f6"
                      isDarkMode={isDarkMode}
                    >
                      <Edit2 size={14} />
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => handleDelete(sa)}
                      loading={actionLoading[sa._id + "_delete"]}
                      title="Delete"
                      color="#ef4444"
                      isDarkMode={isDarkMode}
                    >
                      <Trash2 size={14} />
                    </ActionBtn>
                  </div>

                  {isExpanded ? <ChevronUp size={16} color={c.muted} /> : <ChevronDown size={16} color={c.muted} />}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    borderTop: `1px solid ${c.border}`,
                    padding: "16px 20px",
                    background: isDarkMode ? "#0f1117" : "#f8faff",
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                      {/* Assigned teachers */}
                      <div>
                        <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Assigned Teachers
                        </p>
                        {sa.assignmentType === "region" ? (
                          <p style={{ fontSize: "13px", color: c.text, margin: 0 }}>
                            🌍 All <strong style={{ textTransform: "capitalize" }}>{sa.region}</strong> teachers (auto)
                          </p>
                        ) : sa.assignedTeachers?.length === 0 ? (
                          <p style={{ fontSize: "13px", color: c.muted, fontStyle: "italic", margin: 0 }}>None assigned</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {sa.assignedTeachers?.map((t) => (
                              <div key={t._id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{
                                  width: "28px", height: "28px", borderRadius: "8px",
                                  background: "linear-gradient(135deg, #3b82f6, #6b82f0)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "11px", fontWeight: "700", color: "white",
                                }}>
                                  {t.firstName?.[0]}{t.lastName?.[0]}
                                </div>
                                <div>
                                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: c.heading }}>{t.firstName} {t.lastName}</p>
                                  <p style={{ margin: 0, fontSize: "11px", color: c.muted }}>{t.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Permissions */}
                      <div>
                        <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Permissions
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          {PERMS.map(({ key, label }) => (
                            <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {sa.permissions?.[key]
                                ? <CheckCircle size={14} color="#10b981" />
                                : <XCircle size={14} color="#ef4444" />
                              }
                              <span style={{ fontSize: "13px", color: c.text }}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {sa.notes && (
                      <p style={{
                        margin: "12px 0 0", fontSize: "13px", color: c.muted,
                        padding: "10px 14px",
                        background: isDarkMode ? "#1a1d2e" : "#eef0ff",
                        borderRadius: "10px",
                        fontStyle: "italic",
                      }}>
                        📝 {sa.notes}
                      </p>
                    )}

                    <p style={{ margin: "10px 0 0", fontSize: "11.5px", color: c.muted }}>
                      Last login: {sa.lastLogin ? new Date(sa.lastLogin).toLocaleString() : "Never"}
                      {" · "}
                      Created: {new Date(sa.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .sa-spin { animation: sa-rotate 0.8s linear infinite; }
        @keyframes sa-rotate { to { transform: rotate(360deg); } }
        .sa-scroll::-webkit-scrollbar { width: 4px; }
        .sa-scroll::-webkit-scrollbar-thumb { background: ${isDarkMode ? "#1e2235" : "#dde3f8"}; border-radius: 4px; }
      `}</style>
    </div>
  );
}

function ActionBtn({ onClick, loading, title, color, isDarkMode, children }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      style={{
        width: "32px", height: "32px", borderRadius: "8px", border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        background: isDarkMode ? "#1a1d2e" : "#f0f4ff",
        color, display: "flex", alignItems: "center", justifyContent: "center",
        opacity: loading ? 0.6 : 1, transition: "background 0.15s",
      }}
    >
      {loading ? <div style={{ width: "12px", height: "12px", border: `2px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", animation: "sa-rotate 0.8s linear infinite" }} /> : children}
    </button>
  );
}

const s = {
  label: (dark) => ({
    display: "block", fontSize: "11.5px", fontWeight: "700",
    color: dark ? "#6b7280" : "#64748b",
    textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: "8px",
  }),
  input: (dark) => ({
    width: "100%", padding: "11px 14px",
    background: dark ? "#0f1117" : "#f8faff",
    border: `1.5px solid ${dark ? "#1e2235" : "#e2e8f0"}`,
    borderRadius: "12px", fontSize: "14px",
    color: dark ? "#e2e8f0" : "#1e293b",
    fontFamily: "inherit", outline: "none",
  }),
};

function palette(dark) {
  return {
    card:    dark ? "#1a1d27" : "#ffffff",
    border:  dark ? "#1e2235" : "#e8ecf4",
    heading: dark ? "#e2e8f0" : "#1e293b",
    text:    dark ? "#94a3b8" : "#475569",
    muted:   dark ? "#374151" : "#94a3b8",
  };
}
