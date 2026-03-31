import React, { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Filter, RefreshCw, BookOpen, RotateCcw, Shield } from "lucide-react";
import api from "../../../api";

const TYPE_META = {
  class_marked: {
    icon:    BookOpen,
    color:   "#10b981",
    bgLight: "#d1fae5",
    bgDark:  "rgba(16,185,129,0.12)",
    label:   "Class Marked",
  },
  class_unmarked: {
    icon:    RotateCcw,
    color:   "#f59e0b",
    bgLight: "#fef3c7",
    bgDark:  "rgba(245,158,11,0.12)",
    label:   "Class Unmarked",
  },
};

function getTypeMeta(type) {
  return TYPE_META[type] || {
    icon: Bell,
    color:  "#6366f1",
    bgLight: "#e0e7ff",
    bgDark:  "rgba(99,102,241,0.12)",
    label:  "Activity",
  };
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsTab({ isDarkMode, onUnreadCount }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [filterDate, setFilterDate]       = useState("");
  const [filterUnread, setFilterUnread]   = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);

  const dark = isDarkMode;
  const token = localStorage.getItem("adminToken");

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await api.get("/api/notifications?limit=200");
      const data = res.data;
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        onUnreadCount?.(data.unreadCount);
      }
    } catch (e) {
      console.error("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [onUnreadCount]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch("/api/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      onUnreadCount?.(0);
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingAll(false);
    }
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      onUnreadCount?.((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error(e);
    }
  };

  // Client-side filters
  const filtered = notifications.filter((n) => {
    if (filterUnread && n.read) return false;
    if (filterDate && new Date(n.createdAt).toISOString().slice(0, 10) !== filterDate) return false;
    return true;
  });

  // ── Styles ────────────────────────────────────────────────────────────────
  const bg      = dark ? "#0f1117" : "#f4f6fb";
  const card    = dark ? "#1a1d27" : "#ffffff";
  const border  = dark ? "#1e2235" : "#e8ecf4";
  const text    = dark ? "#e2e8f0" : "#1e293b";
  const muted   = dark ? "#6b7280" : "#94a3b8";
  const inputBg = dark ? "#13161f" : "#f8fafc";

  return (
    <div style={{ fontFamily: "var(--font-body)", color: text }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "14px",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 20px rgba(99,102,241,0.3)",
          }}>
            <Bell size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: text }}>Notifications</h2>
            <p style={{ margin: 0, fontSize: "12px", color: muted }}>
              Sub-admin activity log
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: "8px", background: "#ef4444", color: "white",
                  borderRadius: "10px", padding: "1px 7px",
                  fontSize: "11px", fontWeight: "700",
                }}>
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={fetchNotifications}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "10px", border: `1px solid ${border}`,
              background: card, color: muted, fontSize: "13px", fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", borderRadius: "10px", border: "none",
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "white", fontSize: "13px", fontWeight: "700",
                cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{
        display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={13} color={muted} />
          <span style={{ fontSize: "12px", color: muted, fontWeight: "600" }}>Filter:</span>
        </div>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{
            padding: "7px 12px", borderRadius: "8px",
            border: `1px solid ${border}`, background: inputBg,
            color: text, fontSize: "13px", fontFamily: "inherit",
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600", color: muted }}>
          <input
            type="checkbox"
            checked={filterUnread}
            onChange={(e) => setFilterUnread(e.target.checked)}
            style={{ accentColor: "#6366f1" }}
          />
          Unread only
        </label>
        {(filterDate || filterUnread) && (
          <button
            onClick={() => { setFilterDate(""); setFilterUnread(false); }}
            style={{ fontSize: "12px", color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: "600" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%", margin: "0 auto",
            border: "3px solid #e5e7eb", borderTopColor: "#6366f1",
            animation: "spin 0.75s linear infinite",
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: card, borderRadius: "16px", border: `1px solid ${border}`,
        }}>
          <Bell size={40} color={muted} style={{ marginBottom: "12px" }} />
          <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: text }}>No notifications</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: muted }}>
            {filterDate || filterUnread ? "Try clearing your filters." : "Sub-admin activities will appear here."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((n) => {
            const meta = getTypeMeta(n.type);
            const TypeIcon = meta.icon;
            return (
              <div
                key={n._id}
                onClick={() => !n.read && markOneRead(n._id)}
                style={{
                  display: "flex", gap: "14px", alignItems: "flex-start",
                  background: n.read ? card : (dark ? "rgba(99,102,241,0.08)" : "#f0f4ff"),
                  border: `1px solid ${n.read ? border : (dark ? "rgba(99,102,241,0.25)" : "#c7d2fe")}`,
                  borderRadius: "14px", padding: "14px 16px",
                  cursor: n.read ? "default" : "pointer",
                  transition: "background 0.15s, border 0.15s",
                  position: "relative",
                }}
              >
                {/* Unread dot */}
                {!n.read && (
                  <div style={{
                    position: "absolute", top: "14px", right: "14px",
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: "#6366f1",
                  }} />
                )}

                {/* Type icon */}
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
                  background: dark ? meta.bgDark : meta.bgLight,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TypeIcon size={18} color={meta.color} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: "700", color: meta.color,
                      background: dark ? meta.bgDark : meta.bgLight,
                      padding: "2px 8px", borderRadius: "6px",
                    }}>
                      {meta.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Shield size={11} color={muted} />
                      <span style={{ fontSize: "12px", color: muted, fontWeight: "600" }}>{n.subAdminName}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: "13.5px", color: text, fontWeight: n.read ? "400" : "600", lineHeight: "1.5" }}>
                    {n.message}
                  </p>
                  {n.metadata?.classTitle && (
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: muted }}>
                      Class: <strong style={{ color: text }}>{n.metadata.classTitle}</strong>
                    </p>
                  )}
                  <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: muted }}>
                    {timeAgo(n.createdAt)} · {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
