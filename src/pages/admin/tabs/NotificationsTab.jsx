import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCheck, Filter, RefreshCw, BookOpen, RotateCcw, Shield, CalendarCheck, CalendarX, User } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/i18n.js";

// For text in file-level lists: read when rendered, so it follows the chosen language
const ta = (key, opts) => i18n.t(`admin:${key}`, opts);


const TYPE_META = {
  class_marked: {
    icon:    BookOpen,
    color:   "#10b981",
    bgLight: "#d1fae5",
    bgDark:  "rgba(16,185,129,0.12)",
    get label() { return ta("notificationsTab.type.classMarked"); },
  },
  class_unmarked: {
    icon:    RotateCcw,
    color:   "#f59e0b",
    bgLight: "#fef3c7",
    bgDark:  "rgba(245,158,11,0.12)",
    get label() { return ta("notificationsTab.type.classUnmarked"); },
  },
  // A teacher answered a class the admin booked for them
  booking_accepted: {
    icon:    CalendarCheck,
    color:   "#059669",
    bgLight: "#d1fae5",
    bgDark:  "rgba(5,150,105,0.12)",
    get label() { return ta("notificationsTab.type.classAccepted"); },
  },
  booking_rejected: {
    icon:    CalendarX,
    color:   "#dc2626",
    bgLight: "#fee2e2",
    bgDark:  "rgba(220,38,38,0.12)",
    get label() { return ta("notificationsTab.type.classDeclined"); },
  },
};

function getTypeMeta(type) {
  return TYPE_META[type] || {
    icon: Bell,
    color:  "var(--a-accent-ink)",
    bgLight: "var(--a-accent-soft)",
    bgDark:  "rgba(99,102,241,0.12)",
    label:  ta("notificationsTab.type.activity"),
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
  const { t: tr } = useTranslation("admin");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [filterDate, setFilterDate]       = useState("");
  const [filterUnread, setFilterUnread]   = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);

  const dark = isDarkMode;
  // Live: refresh quietly (no spinner) when the server says this data changed
  const quietRef = useRef(false);
  useOnDataChanged(["notifications"], () => { quietRef.current = true; fetchNotifications(); });

  const fetchNotifications = useCallback(async () => {
    try {
      if (!quietRef.current) setLoading(true);
    quietRef.current = false;
      const res  = await api.get("/notifications?limit=200");
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
      await api.patch("/notifications/read-all");
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
      await api.patch(`/notifications/${id}/read`);
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

  // ── Styles ────────────────────────────────────────────────────────────────  const card    = 'var(--a-surface)';
  const border  = 'var(--a-line)';
  const text    = 'var(--a-ink)';
  const muted   = 'var(--a-muted)';
  const inputBg = 'var(--a-raised)';

  return (
    <div style={{ fontFamily: "var(--font-body)", color: text }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "14px",
            background: "var(--a-accent-grad)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 20px rgba(99,102,241,0.3)",
          }}>
            <Bell size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: text }}>{tr("notificationsTab.notifications")}</h2>
            <p style={{ margin: 0, fontSize: "12px", color: muted }}>
              {tr("notificationsTab.subAdminActivityLog")}
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: "8px", background: "#ef4444", color: "white",
                  borderRadius: "10px", padding: "1px 7px",
                  fontSize: "11px", fontWeight: "700",
                }}>
                  {tr("notificationsTab.unread", { unreadCount })}</span>
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
            {tr("notificationsTab.refresh")}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", borderRadius: "10px", border: "none",
                background: "var(--a-accent-grad)",
                color: "white", fontSize: "13px", fontWeight: "700",
                cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
              }}
            >
              <CheckCheck size={14} />
              {tr("notificationsTab.markAllRead")}
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
          <span style={{ fontSize: "12px", color: muted, fontWeight: "600" }}>{tr("notificationsTab.filter")}</span>
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
            style={{ accentColor: "var(--a-accent-ink)" }}
          />
          {tr("notificationsTab.unreadOnly")}
        </label>
        {(filterDate || filterUnread) && (
          <button
            onClick={() => { setFilterDate(""); setFilterUnread(false); }}
            style={{ fontSize: "12px", color: "var(--a-accent-ink)", background: "none", border: "none", cursor: "pointer", fontWeight: "600" }}
          >
            {tr("notificationsTab.clear")}
          </button>
        )}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%", margin: "0 auto",
            border: "3px solid var(--a-line)", borderTopColor: "var(--a-accent)",
            animation: "spin 0.75s linear infinite",
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: card, borderRadius: "16px", border: `1px solid ${border}`,
        }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%", background: "var(--a-accent-soft)", boxShadow: "inset 0 0 0 1px var(--a-accent-line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={28} color="var(--a-accent)" />
          </div>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: text }}>{tr("notificationsTab.noNotifications")}</p>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: muted }}>
            {filterDate || filterUnread ? tr("notificationsTab.tryClearingYourFilters") : tr("notificationsTab.subAdminActivitiesWillAppear")}
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
                  background: n.read ? card : ('var(--a-raised)'),
                  border: `1px solid ${n.read ? border : ('var(--a-accent-line)')}`,
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
                    background: "var(--a-accent-grad)",
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
                      {n.subAdminName ? <Shield size={11} color={muted} /> : <User size={11} color={muted} />}
                      <span style={{ fontSize: "12px", color: muted, fontWeight: "600" }}>
                        {n.subAdminName || n.actorName}{!n.subAdminName && n.actorRole ? ` · ${n.actorRole[0].toUpperCase()}${n.actorRole.slice(1)}` : ""}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: "13.5px", color: text, fontWeight: n.read ? "400" : "600", lineHeight: "1.5" }}>
                    {n.message}
                  </p>
                  {n.metadata?.classTitle && (
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: muted }}>
                      {tr("notificationsTab.class")} <strong style={{ color: text }}>{n.metadata.classTitle}</strong>
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
