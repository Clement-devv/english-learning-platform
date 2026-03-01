// src/components/chat/GroupChatList.jsx
import React, { useState, useEffect } from "react";
import { Search, MessageCircle, CheckCheck } from "lucide-react";
import api from "../../api";

export default function GroupChatList({ userRole, onSelectChat, selectedChatId, isDark }) {
  const [chats, setChats]             = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading]         = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    fetchChats();
    const id = setInterval(fetchChats, 10000);
    return () => clearInterval(id);
  }, [userRole]);

  const fetchChats = async () => {
    try {
      const res = await api.get("/api/group-chats");
      let data = res.data?.chats || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      if (!Array.isArray(data)) data = [];
      setChats(data);
      setTotalUnread(data.reduce((s, c) => s + (c?.unreadCount?.[userRole] || 0), 0));
    } catch (e) {
      console.error("GroupChatList fetch error:", e);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = chats.filter(c =>
    c?.chatName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date), now = new Date();
    const dm = Math.floor((now - d) / 60000);
    if (dm < 1)       return "now";
    if (dm < 60)      return `${dm}m`;
    if (dm < 1440)    return `${Math.floor(dm/60)}h`;
    if (dm < 10080)   return `${Math.floor(dm/1440)}d`;
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  };

  const getInitials = (name = "") => {
    const p = name.trim().split(" ");
    return p.length >= 2
      ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const roleGrad = {
    admin:   "linear-gradient(135deg,#7c3aed,#a855f7)",
    teacher: "linear-gradient(135deg,#1d4ed8,#0891b2)",
    student: "linear-gradient(135deg,#047857,#10b981)",
  };

  const C = {
    bg:      isDark ? "#16191f" : "#f8f9ff",
    text:    isDark ? "#e4e6ef" : "#1a1d2e",
    sub:     isDark ? "#4a4f6a" : "#9ea3be",
    border:  isDark ? "rgba(255,255,255,0.06)" : "#eef0f8",
    inputBg: isDark ? "#1e2130" : "#eef0f8",
    hover:   isDark ? "rgba(255,255,255,0.04)" : "rgba(99,102,241,0.05)",
    active:  isDark ? "rgba(99,102,241,0.14)"  : "rgba(99,102,241,0.09)",
    accent:  "#6366f1",
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background: C.bg }}>

      {/* Header */}
      <div style={{ padding:"20px 16px 14px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
          <div>
            <h2 style={{ margin:0, fontSize:"19px", fontWeight:"800", color: C.text, letterSpacing:"-0.3px" }}>
              Messages
            </h2>
            {totalUnread > 0 && (
              <span style={{ fontSize:"11.5px", color: C.accent, fontWeight:"700" }}>
                {totalUnread} unread
              </span>
            )}
          </div>
          <div style={{
            width:"38px", height:"38px", borderRadius:"12px",
            background: isDark ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.10)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <MessageCircle size={18} color={C.accent} />
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position:"relative" }}>
          <Search size={14} color={C.sub}
            style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)" }}
          />
          <input
            type="text"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width:"100%", padding:"9px 12px 9px 34px",
              background: C.inputBg, border:"none", borderRadius:"11px",
              fontSize:"13px", color: C.text, outline:"none", fontFamily:"inherit",
              transition:"box-shadow 0.2s",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"6px 0" }}>
        {loading ? (
          <Skeleton isDark={isDark} C={C} />
        ) : filtered.length === 0 ? (
          <div style={{ padding:"48px 20px", textAlign:"center", color: C.sub }}>
            <MessageCircle size={32} style={{ opacity:0.25, marginBottom:"8px" }} />
            <p style={{ margin:0, fontSize:"13px" }}>
              {searchQuery ? "No results found" : "No conversations yet"}
            </p>
          </div>
        ) : (
          filtered.map(chat => {
            const isSelected = selectedChatId === chat._id;
            const unread     = chat.unreadCount?.[userRole] || 0;
            const name       = chat.chatName || "Unnamed";
            const lastMsg    = chat.lastMessage;

            return (
              <button
                key={chat._id}
                onClick={() => onSelectChat(chat)}
                style={{
                  width:"100%", display:"flex", alignItems:"center", gap:"12px",
                  padding:"10px 16px",
                  background: isSelected ? C.active : "transparent",
                  border:"none", cursor:"pointer", textAlign:"left",
                  borderLeft: `3px solid ${isSelected ? C.accent : "transparent"}`,
                  transition:"background 0.15s",
                }}
                onMouseEnter={e => !isSelected && (e.currentTarget.style.background = C.hover)}
                onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "transparent")}
              >
                {/* Avatar */}
                <div style={{
                  width:"46px", height:"46px", borderRadius:"14px",
                  background: roleGrad[userRole] || roleGrad.student,
                  flexShrink:0, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:"14px", fontWeight:"700",
                  color:"white", boxShadow:"0 3px 10px rgba(0,0,0,0.2)",
                }}>
                  {getInitials(name)}
                </div>

                {/* Text */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"3px" }}>
                    <span style={{
                      fontSize:"13.5px", fontWeight: unread ? "700" : "600",
                      color: C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>{name}</span>
                    <span style={{ fontSize:"11px", color: unread ? C.accent : C.sub, flexShrink:0, marginLeft:"8px" }}>
                      {formatTime(lastMsg?.timestamp || chat.lastActivityAt)}
                    </span>
                  </div>

                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <p style={{
                      margin:0, fontSize:"12px", color: unread ? (isDark ? "#c0c4d8" : "#4a4f6a") : C.sub,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      fontWeight: unread ? "600" : "400", flex:1,
                    }}>
                      {lastMsg ? (
                        <span>
                          <CheckCheck size={12} style={{ display:"inline", marginRight:"4px", opacity:0.55 }} />
                          {lastMsg.senderName?.split(" ")[0]}: {lastMsg.text}
                        </span>
                      ) : (
                        <em style={{ opacity:0.5 }}>No messages yet</em>
                      )}
                    </p>
                    {unread > 0 && (
                      <span style={{
                        minWidth:"20px", height:"20px", borderRadius:"10px",
                        background: C.accent, color:"white",
                        fontSize:"10.5px", fontWeight:"700",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        padding:"0 6px", marginLeft:"8px", flexShrink:0,
                      }}>{unread}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      {chats.length > 0 && (
        <div style={{
          padding:"10px 16px", borderTop:`1px solid ${C.border}`,
          display:"flex", justifyContent:"space-between", fontSize:"11px", color: C.sub,
        }}>
          <span>{filtered.length} conversation{filtered.length !== 1 ? "s" : ""}</span>
          {totalUnread > 0 && <span style={{ color: C.accent, fontWeight:"700" }}>{totalUnread} unread</span>}
        </div>
      )}
    </div>
  );
}

function Skeleton({ C }) {
  return (
    <div style={{ padding:"6px 16px" }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ display:"flex", gap:"12px", padding:"10px 0", alignItems:"center" }}>
          <div style={{ width:"46px", height:"46px", borderRadius:"14px", background: C.inputBg, flexShrink:0 }} className="msg-pulse" />
          <div style={{ flex:1 }}>
            <div style={{ height:"13px", width:"55%", background: C.inputBg, borderRadius:"6px", marginBottom:"8px" }} className="msg-pulse" />
            <div style={{ height:"11px", width:"78%", background: C.inputBg, borderRadius:"6px" }} className="msg-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
