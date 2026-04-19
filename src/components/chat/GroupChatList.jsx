// src/components/chat/GroupChatList.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Search, MessageCircle, CheckCheck, Shield, Plus } from "lucide-react";
import api from "../../api";

export default function GroupChatList({ userRole, onSelectChat, selectedChatId, isDark, onUnreadCount }) {
  const [groupChats,  setGroupChats]  = useState([]);
  const [dms,         setDms]         = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading,     setLoading]     = useState(true);
  const [startingDm,  setStartingDm]  = useState(false);

  const C = {
    bg:         isDark ? "#13151c" : "#f8f9ff",
    text:       isDark ? "#e8eaf6" : "#1a1d2e",
    sub:        isDark ? "#8b91b8" : "#9ea3be",
    border:     isDark ? "rgba(255,255,255,0.09)" : "#eef0f8",
    inputBg:    isDark ? "#1e2235" : "#eef0f8",
    inputTxt:   isDark ? "#e8eaf6" : "#1a1d2e",
    hover:      isDark ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.05)",
    active:     isDark ? "rgba(99,102,241,0.18)"  : "rgba(99,102,241,0.09)",
    accent:     "#6366f1",
    sectionTxt: isDark ? "#6b72a0" : "#b0b5d0",
  };

  const fetchAll = useCallback(async () => {
    try {
      const [gcRes, dmRes] = await Promise.allSettled([
        api.get("/group-chats"),
        api.get("/direct-messages"),
      ]);
      if (gcRes.status === "fulfilled") {
        const data = gcRes.value.data?.chats || [];
        setGroupChats(Array.isArray(data) ? data : []);
      }
      if (dmRes.status === "fulfilled") {
        const data = dmRes.value.data?.dms || [];
        setDms(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("GroupChatList fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Map userRole to the unreadCount key used in DB
  const unreadKey = userRole === "sub-admin" ? "subAdmin" : userRole;

  // Emit total unread count to parent whenever it changes
  const totalUnread =
    groupChats.reduce((s, c) => s + (c?.unreadCount?.[unreadKey] || 0), 0) +
    dms.reduce((s, d) => s + (d?.unreadCount?.[unreadKey] || 0), 0);

  useEffect(() => {
    onUnreadCount?.(totalUnread);
  }, [totalUnread, onUnreadCount]);

  const startAdminDm = async () => {
    if (startingDm) return;
    try {
      setStartingDm(true);
      const res = await api.post("/direct-messages/start");
      if (res.data.success) {
        await fetchAll();
        onSelectChat({ ...res.data.dm, _chatType: "dm" });
      }
    } catch (e) {
      console.error("Start DM error:", e);
    } finally {
      setStartingDm(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date), now = new Date();
    const dm = Math.floor((now - d) / 60000);
    if (dm < 1)     return "now";
    if (dm < 60)    return `${dm}m`;
    if (dm < 1440)  return `${Math.floor(dm / 60)}h`;
    if (dm < 10080) return `${Math.floor(dm / 1440)}d`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getInitials = (name = "") => {
    const p = name.trim().split(" ");
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  // Derive display info for a DM — proper names + role badges
  const getDmInfo = (dm) => {
    // Admin sees who sent the DM
    if (userRole === "admin") {
      if (dm.type === "teacher-admin" && dm.teacherId) {
        const name = `${dm.teacherId.firstName} ${dm.teacherId.lastName}`;
        return { name, initials: getInitials(name), roleBadge: "Teacher",
          avatarBg: "linear-gradient(135deg,#1d4ed8,#0891b2)",
          badgeColor: isDark ? "#bfdbfe" : "#1d4ed8", badgeBg: isDark ? "rgba(29,78,216,0.25)" : "rgba(29,78,216,0.10)" };
      }
      if (dm.type === "student-admin" && dm.studentId) {
        const name = `${dm.studentId.firstName} ${dm.studentId.lastName}`;
        return { name, initials: getInitials(name), roleBadge: "Student",
          avatarBg: "linear-gradient(135deg,#047857,#10b981)",
          badgeColor: isDark ? "#a7f3d0" : "#047857", badgeBg: isDark ? "rgba(4,120,87,0.25)" : "rgba(4,120,87,0.10)" };
      }
      if (dm.type === "sub-admin-admin" && dm.subAdminId) {
        const name = `${dm.subAdminId.firstName} ${dm.subAdminId.lastName}`;
        return { name, initials: getInitials(name), roleBadge: "Sub-Admin",
          avatarBg: "linear-gradient(135deg,#b45309,#f59e0b)",
          badgeColor: isDark ? "#fde68a" : "#b45309", badgeBg: isDark ? "rgba(180,83,9,0.25)" : "rgba(180,83,9,0.10)" };
      }
    }
    // Sub-admin sees "Admin" as the other party
    if (userRole === "sub-admin") {
      return { name: "Admin", initials: "AD", roleBadge: "Admin",
        avatarBg: "linear-gradient(135deg,#7c3aed,#a855f7)",
        badgeColor: isDark ? "#e9d5ff" : "#7c3aed", badgeBg: isDark ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.10)" };
    }
    const name = dm.chatName || "Admin";
    return { name, initials: getInitials(name), roleBadge: null,
      avatarBg: "linear-gradient(135deg,#7c3aed,#a855f7)", badgeColor: null, badgeBg: null };
  };

  const roleGrad = {
    admin:   "linear-gradient(135deg,#7c3aed,#a855f7)",
    teacher: "linear-gradient(135deg,#1d4ed8,#0891b2)",
    student: "linear-gradient(135deg,#047857,#10b981)",
  };

  const filteredGroups = groupChats.filter(c =>
    c?.chatName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // For DM search: match against derived name
  const filteredDms = dms.filter(dm => {
    const info = getDmInfo(dm);
    return info.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <>
      <style>{`
        .gc-search::placeholder { color: ${C.sub}; opacity: 1; }
        .gc-search:focus { outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.3); }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>

        {/* Header */}
        <div style={{ padding: "20px 16px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "19px", fontWeight: "800", color: C.text, letterSpacing: "-0.3px" }}>
                Messages
              </h2>
              {totalUnread > 0 && (
                <span style={{ fontSize: "11.5px", color: C.accent, fontWeight: "700" }}>
                  {totalUnread} unread
                </span>
              )}
            </div>
            <div style={{
              width: "38px", height: "38px", borderRadius: "12px",
              background: isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <MessageCircle size={18} color={C.accent} />
              {totalUnread > 0 && (
                <div style={{
                  position: "absolute", top: "-5px", right: "-5px",
                  minWidth: "18px", height: "18px", borderRadius: "9px",
                  background: "#ef4444", color: "white",
                  fontSize: "10px", fontWeight: "800",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {totalUnread > 99 ? "99+" : totalUnread}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} color={C.sub}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              className="gc-search"
              type="text"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 34px", boxSizing: "border-box",
                background: C.inputBg, border: `1px solid ${C.border}`,
                borderRadius: "11px", fontSize: "13px",
                color: C.inputTxt, fontFamily: "inherit",
                transition: "box-shadow 0.2s",
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {loading ? (
            <Skeleton C={C} />
          ) : (
            <>
              {/* Direct Messages */}
              <SectionLabel label="Direct Messages" color={C.sectionTxt} />

              {filteredDms.length > 0 ? (
                filteredDms.map(dm => {
                  const info = getDmInfo(dm);
                  return (
                    <DmRow
                      key={dm._id}
                      chat={{ ...dm, _chatType: "dm" }}
                      isSelected={selectedChatId === dm._id}
                      unread={dm.unreadCount?.[unreadKey] || 0}
                      isDark={isDark}
                      C={C}
                      onSelect={onSelectChat}
                      formatTime={formatTime}
                      info={info}
                    />
                  );
                })
              ) : userRole !== "admin" ? (
                <div style={{ padding: "8px 16px 4px" }}>
                  <button
                    onClick={startAdminDm}
                    disabled={startingDm}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px", borderRadius: "12px",
                      border: `1.5px dashed ${isDark ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.3)"}`,
                      background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)",
                      cursor: startingDm ? "wait" : "pointer", color: C.accent,
                      fontSize: "13px", fontWeight: "600", fontFamily: "inherit",
                    }}
                  >
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
                      background: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Plus size={15} color={C.accent} />
                    </div>
                    {startingDm ? "Opening…" : "Message Admin"}
                  </button>
                </div>
              ) : (
                <p style={{ padding: "12px 20px", fontSize: "12px", color: C.sub, margin: 0 }}>
                  No direct messages yet
                </p>
              )}

              {/* Group Chats */}
              <SectionLabel label="Group Chats" color={C.sectionTxt} style={{ marginTop: 8 }} />

              {filteredGroups.length === 0 ? (
                <p style={{ padding: "12px 20px", fontSize: "12px", color: C.sub, margin: 0 }}>
                  {searchQuery ? "No results found" : "No group chats yet"}
                </p>
              ) : (
                filteredGroups.map(chat => (
                  <ChatRow
                    key={chat._id}
                    chat={{ ...chat, _chatType: "group" }}
                    isSelected={selectedChatId === chat._id}
                    unread={chat.unreadCount?.[unreadKey] || 0}
                    isDark={isDark}
                    C={C}
                    onSelect={onSelectChat}
                    formatTime={formatTime}
                    avatarBg={roleGrad[userRole] || roleGrad.student}
                    initials={getInitials(chat.chatName || "")}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 16px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", fontSize: "11px", color: C.sub,
        }}>
          <span>{filteredGroups.length + filteredDms.length} conversation{filteredGroups.length + filteredDms.length !== 1 ? "s" : ""}</span>
          {totalUnread > 0 && <span style={{ color: C.accent, fontWeight: "700" }}>{totalUnread} unread</span>}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ label, color }) {
  return (
    <div style={{
      padding: "10px 16px 4px",
      fontSize: "10px", fontWeight: "800",
      letterSpacing: "0.08em", textTransform: "uppercase",
      color,
    }}>
      {label}
    </div>
  );
}

// DM row — shows proper name + role badge for admin
function DmRow({ chat, isSelected, unread, isDark, C, onSelect, formatTime, info }) {
  const lastMsg = chat.lastMessage;

  return (
    <button
      onClick={() => onSelect(chat)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 16px",
        background: isSelected ? C.active : "transparent",
        border: "none", cursor: "pointer", textAlign: "left",
        borderLeft: `3px solid ${isSelected ? C.accent : "transparent"}`,
        transition: "background 0.15s",
      }}
      onMouseEnter={e => !isSelected && (e.currentTarget.style.background = C.hover)}
      onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "transparent")}
    >
      {/* Avatar */}
      <div style={{
        width: "46px", height: "46px", borderRadius: "14px",
        background: info.avatarBg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "14px", fontWeight: "700", color: "white",
        boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
      }}>
        {info.initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <span style={{
              fontSize: "13.5px", fontWeight: unread ? "700" : "600",
              color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {info.name}
            </span>
            {info.roleBadge && (
              <span style={{
                fontSize: "10px", fontWeight: "700", flexShrink: 0,
                padding: "1px 6px", borderRadius: "6px",
                color: info.badgeColor, background: info.badgeBg,
              }}>
                {info.roleBadge}
              </span>
            )}
          </div>
          <span style={{ fontSize: "11px", color: unread ? C.accent : C.sub, flexShrink: 0, marginLeft: "8px" }}>
            {formatTime(lastMsg?.timestamp || chat.lastActivityAt)}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{
            margin: 0, fontSize: "12px",
            color: unread ? (isDark ? "#c8ccec" : "#4a4f6a") : C.sub,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontWeight: unread ? "600" : "400", flex: 1,
          }}>
            {lastMsg ? (
              <span>
                <CheckCheck size={12} style={{ display: "inline", marginRight: "4px", opacity: 0.55 }} />
                {lastMsg.senderName?.split(" ")[0]}: {lastMsg.text}
              </span>
            ) : (
              <em style={{ opacity: 0.5 }}>No messages yet</em>
            )}
          </p>
          {unread > 0 && (
            <span style={{
              minWidth: "20px", height: "20px", borderRadius: "10px",
              background: C.accent, color: "white",
              fontSize: "10.5px", fontWeight: "700",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 6px", marginLeft: "8px", flexShrink: 0,
            }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// Group chat row (unchanged behaviour)
function ChatRow({ chat, isSelected, unread, isDark, C, onSelect, formatTime, avatarBg, initials }) {
  const lastMsg = chat.lastMessage;
  const name    = chat.chatName || "Unnamed";

  return (
    <button
      onClick={() => onSelect(chat)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 16px",
        background: isSelected ? C.active : "transparent",
        border: "none", cursor: "pointer", textAlign: "left",
        borderLeft: `3px solid ${isSelected ? C.accent : "transparent"}`,
        transition: "background 0.15s",
      }}
      onMouseEnter={e => !isSelected && (e.currentTarget.style.background = C.hover)}
      onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "transparent")}
    >
      <div style={{
        width: "46px", height: "46px", borderRadius: "14px",
        background: avatarBg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "14px", fontWeight: "700", color: "white",
        boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
      }}>
        {initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
          <span style={{
            fontSize: "13.5px", fontWeight: unread ? "700" : "600",
            color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{name}</span>
          <span style={{ fontSize: "11px", color: unread ? C.accent : C.sub, flexShrink: 0, marginLeft: "8px" }}>
            {formatTime(lastMsg?.timestamp || chat.lastActivityAt)}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{
            margin: 0, fontSize: "12px",
            color: unread ? (isDark ? "#c8ccec" : "#4a4f6a") : C.sub,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontWeight: unread ? "600" : "400", flex: 1,
          }}>
            {lastMsg ? (
              <span>
                <CheckCheck size={12} style={{ display: "inline", marginRight: "4px", opacity: 0.55 }} />
                {lastMsg.senderName?.split(" ")[0]}: {lastMsg.text}
              </span>
            ) : (
              <em style={{ opacity: 0.5 }}>No messages yet</em>
            )}
          </p>
          {unread > 0 && (
            <span style={{
              minWidth: "20px", height: "20px", borderRadius: "10px",
              background: C.accent, color: "white",
              fontSize: "10.5px", fontWeight: "700",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 6px", marginLeft: "8px", flexShrink: 0,
            }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Skeleton({ C }) {
  return (
    <div style={{ padding: "6px 16px" }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 0", alignItems: "center" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: C.inputBg, flexShrink: 0 }} className="msg-pulse" />
          <div style={{ flex: 1 }}>
            <div style={{ height: "13px", width: "55%", background: C.inputBg, borderRadius: "6px", marginBottom: "8px" }} className="msg-pulse" />
            <div style={{ height: "11px", width: "78%", background: C.inputBg, borderRadius: "6px" }} className="msg-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
