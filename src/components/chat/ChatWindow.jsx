// src/components/chat/ChatWindow.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  Send, ArrowLeft, Users, Loader2,
  Paperclip, Smile, MoreVertical, Search, CheckCheck,
} from "lucide-react";
import api from "../../api";

export default function ChatWindow({ chat, userRole, onClose, isDark }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef(null);
  const textareaRef             = useRef(null);
  const inputWrapRef            = useRef(null);

  useEffect(() => {
    if (!chat?._id) return;
    fetchMessages();
    markAsRead();
    const id = setInterval(fetchMessages, 5000);
    return () => clearInterval(id);
  }, [chat?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    if (!chat?._id) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/group-chats/${chat._id}/messages`);
      const msgs = res.data?.messages || (Array.isArray(res.data) ? res.data : []);
      setMessages(msgs);
    } catch (e) {
      console.error("Fetch messages error:", e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try { await api.patch(`/api/group-chats/${chat._id}/mark-read`); } catch {}
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || sending) return;
    try {
      setSending(true);
      const res = await api.post(`/api/group-chats/${chat._id}/messages`, { message: newMsg.trim() });
      if (res.data.success) {
        setMessages(prev => [...prev, res.data.data]);
        setNewMsg("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.focus();
        }
      }
    } catch (e) {
      console.error("Send error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
  };

  // ── Helpers ─────────────────────────────────────
  const fmtTime = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });
  };

  const fmtDate = (d) => {
    if (!d) return "";
    const date = new Date(d), today = new Date();
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yest.toDateString())  return "Yesterday";
    return date.toLocaleDateString("en-US", {
      month:"short", day:"numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const getInitials = (name = "") => {
    const p = name.trim().split(" ");
    return p.length >= 2
      ? (p[0][0] + p[p.length-1][0]).toUpperCase()
      : name.slice(0,2).toUpperCase();
  };

  const roleStyle = {
    admin:   { grad:"linear-gradient(135deg,#7c3aed,#a855f7)", bubble:"linear-gradient(135deg,#7c3aed,#8b5cf6)", badge:"#7c3aed" },
    teacher: { grad:"linear-gradient(135deg,#1d4ed8,#0891b2)", bubble:"linear-gradient(135deg,#2563eb,#06b6d4)", badge:"#1d4ed8" },
    student: { grad:"linear-gradient(135deg,#047857,#10b981)", bubble:"linear-gradient(135deg,#059669,#10b981)", badge:"#047857" },
  };

  const myStyle = roleStyle[userRole] || roleStyle.student;

  const grouped = messages.reduce((acc, m) => {
    const key = fmtDate(m.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  // ── Colour tokens ─────────────────────────────
  const C = {
    bg:       isDark ? "#111318" : "#f5f6fb",
    header:   isDark ? "#16191f" : "#ffffff",
    border:   isDark ? "rgba(255,255,255,0.06)" : "#eef0f8",
    text:     isDark ? "#e4e6ef" : "#1a1d2e",
    sub:      isDark ? "#4a4f6a" : "#9ea3be",
    inBubble: isDark ? "#1e2130" : "#ffffff",
    inText:   isDark ? "#d4d7e8" : "#2d3048",
    dateBg:   isDark ? "#1a1d28" : "#eef0f8",
    inputBg:  isDark ? "#1e2130" : "#ffffff",
    inputBdr: isDark ? "rgba(255,255,255,0.09)" : "#e2e4f0",
    footer:   isDark ? "#16191f" : "#ffffff",
    accent:   "#6366f1",
  };

  return (
    <div style={{
      display:"flex", flexDirection:"column", height:"100%",
      background: C.bg, fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"13px 18px", background: C.header, borderBottom:`1px solid ${C.border}`,
        flexShrink:0, gap:"12px",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"11px", minWidth:0 }}>
          <button onClick={onClose} className="msg-back-btn" style={{
            background:"none", border:"none", cursor:"pointer", padding:"6px",
            color: C.sub, display:"flex", alignItems:"center", borderRadius:"9px",
            flexShrink:0,
          }}>
            <ArrowLeft size={19} />
          </button>

          <div style={{
            width:"42px", height:"42px", borderRadius:"13px",
            background: myStyle.grad, flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"14px", fontWeight:"700", color:"white",
            boxShadow:"0 4px 12px rgba(0,0,0,0.2)",
          }}>
            {getInitials(chat.chatName || "??")}
          </div>

          <div style={{ minWidth:0 }}>
            <h3 style={{ margin:0, fontSize:"15px", fontWeight:"700", color: C.text,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {chat.chatName || "Chat"}
            </h3>
            <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"2px" }}>
              <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#22c55e", flexShrink:0 }} />
              <span style={{ fontSize:"11.5px", color: C.sub }}>Active now</span>
              <span style={{ color: C.sub, opacity:0.4, fontSize:"14px" }}>·</span>
              <Users size={11} color={C.sub} />
              <span style={{ fontSize:"11.5px", color: C.sub }}>Group</span>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", gap:"2px", flexShrink:0 }}>
          {[Search, MoreVertical].map((Icon, i) => (
            <button key={i} style={{
              background:"none", border:"none", cursor:"pointer",
              padding:"8px", borderRadius:"10px", color: C.sub,
              display:"flex", alignItems:"center", transition:"background 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        style={{ flex:1, overflowY:"auto", padding:"14px 18px", display:"flex", flexDirection:"column" }}
        className="msg-scrollbar"
      >
        {loading && messages.length === 0 ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", color: C.sub }}>
            <Loader2 size={24} color={C.accent} style={{ animation:"msg-spin 1s linear infinite" }} />
            <span style={{ fontSize:"13px" }}>Loading messages…</span>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"10px", color: C.sub }}>
            <Smile size={30} style={{ opacity:0.25 }} />
            <p style={{ margin:0, fontSize:"13.5px" }}>No messages yet — say hello! 👋</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dayMsgs]) => (
            <div key={date}>
              {/* Date pill */}
              <div style={{ display:"flex", alignItems:"center", gap:"10px", margin:"12px 0 8px" }}>
                <div style={{ flex:1, height:"1px", background: C.border }} />
                <span style={{
                  fontSize:"11px", fontWeight:"600", color: C.sub,
                  background: C.dateBg, padding:"3px 12px", borderRadius:"20px",
                }}>
                  {date}
                </span>
                <div style={{ flex:1, height:"1px", background: C.border }} />
              </div>

              {dayMsgs.map((msg, idx) => {
                const isOwn   = msg.senderRole === userRole;
                const sStyle  = roleStyle[msg.senderRole] || roleStyle.student;
                const prevMsg = dayMsgs[idx - 1];
                const showAvt = !isOwn && (!prevMsg || prevMsg.senderRole !== msg.senderRole || prevMsg.senderName !== msg.senderName);
                const isLast  = !dayMsgs[idx + 1] || dayMsgs[idx + 1]?.senderRole !== msg.senderRole;

                return (
                  <div key={msg._id || idx} style={{
                    display:"flex", alignItems:"flex-end", gap:"8px",
                    marginBottom: isLast ? "10px" : "2px",
                    flexDirection: isOwn ? "row-reverse" : "row",
                  }} className="msg-bubble-wrap">
                    {/* Avatar */}
                    {!isOwn && (
                      <div style={{
                        width:"32px", height:"32px", borderRadius:"10px", flexShrink:0,
                        background: showAvt ? sStyle.grad : "transparent",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"11px", fontWeight:"700", color:"white",
                      }}>
                        {showAvt ? getInitials(msg.senderName) : ""}
                      </div>
                    )}

                    <div style={{
                      display:"flex", flexDirection:"column", maxWidth:"66%",
                      alignItems: isOwn ? "flex-end" : "flex-start",
                    }}>
                      {!isOwn && showAvt && (
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px", paddingLeft:"2px" }}>
                          <span style={{ fontSize:"11.5px", fontWeight:"700", color: C.accent }}>
                            {msg.senderName}
                          </span>
                          <span style={{
                            fontSize:"9.5px", fontWeight:"700", color:"white",
                            background: sStyle.badge, padding:"1px 7px",
                            borderRadius:"8px", textTransform:"uppercase", opacity:0.9,
                          }}>
                            {msg.senderRole}
                          </span>
                        </div>
                      )}

                      {/* Bubble */}
                      <div style={{
                        padding:"9px 13px",
                        background: isOwn ? myStyle.bubble : C.inBubble,
                        color: isOwn ? "white" : C.inText,
                        borderRadius: isOwn
                          ? (isLast ? "18px 18px 5px 18px" : "18px")
                          : (isLast ? "18px 18px 18px 5px" : "18px"),
                        boxShadow: isOwn
                          ? "0 4px 14px rgba(99,102,241,0.28)"
                          : isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.06)",
                        border: !isOwn ? `1px solid ${C.border}` : "none",
                      }} className="msg-bubble">
                        <p style={{ margin:0, fontSize:"13.5px", whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:"1.55" }}>
                          {msg.message}
                        </p>
                        <div style={{
                          display:"flex", justifyContent:"flex-end", alignItems:"center",
                          gap:"4px", marginTop:"4px",
                          fontSize:"10.5px",
                          color: isOwn ? "rgba(255,255,255,0.75)" : C.sub,
                        }}>
                          <span>{fmtTime(msg.createdAt)}</span>
                          {isOwn && <CheckCheck size={13} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input footer ── */}
      <div style={{
        padding:"12px 16px", background: C.footer,
        borderTop:`1px solid ${C.border}`, flexShrink:0,
      }}>
        <form onSubmit={handleSend} style={{ display:"flex", alignItems:"flex-end", gap:"8px" }}>

          <button type="button" style={{
            background:"none", border:"none", cursor:"pointer",
            padding:"10px", borderRadius:"12px", color: C.sub,
            display:"flex", alignItems:"center",
          }}>
            <Paperclip size={18} />
          </button>

          {/* Input wrap */}
          <div
            ref={inputWrapRef}
            style={{
              flex:1, display:"flex", alignItems:"flex-end",
              background: C.inputBg, border:`1.5px solid ${C.inputBdr}`,
              borderRadius:"14px", padding:"8px 12px",
              transition:"border-color 0.2s, box-shadow 0.2s",
            }}
          >
            <textarea
              ref={textareaRef}
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              disabled={sending}
              rows={1}
              style={{
                flex:1, border:"none", outline:"none", resize:"none",
                background:"transparent", fontSize:"13.5px", color: C.text,
                fontFamily:"inherit", lineHeight:"1.55",
                maxHeight:"120px", overflowY:"auto",
              }}
              onFocus={() => {
                if (inputWrapRef.current) {
                  inputWrapRef.current.style.borderColor = "#6366f1";
                  inputWrapRef.current.style.boxShadow   = "0 0 0 3px rgba(99,102,241,0.12)";
                }
              }}
              onBlur={() => {
                if (inputWrapRef.current) {
                  inputWrapRef.current.style.borderColor = C.inputBdr;
                  inputWrapRef.current.style.boxShadow   = "none";
                }
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button type="button" style={{
              background:"none", border:"none", cursor:"pointer",
              padding:"2px 0 2px 8px", color: C.sub,
              display:"flex", alignItems:"center",
            }}>
              <Smile size={17} />
            </button>
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!newMsg.trim() || sending}
            className="msg-send-btn"
            style={{
              width:"44px", height:"44px", borderRadius:"13px", border:"none",
              background: newMsg.trim() ? myStyle.bubble : (isDark ? "#1e2130" : "#eef0f8"),
              cursor: newMsg.trim() ? "pointer" : "default",
              display:"flex", alignItems:"center", justifyContent:"center",
              flexShrink:0, transition:"all 0.2s",
              boxShadow: newMsg.trim() ? "0 4px 14px rgba(99,102,241,0.35)" : "none",
            }}
          >
            {sending
              ? <Loader2 size={18} color="white" style={{ animation:"msg-spin 1s linear infinite" }} />
              : <Send size={17} color={newMsg.trim() ? "white" : C.sub} strokeWidth={2} />
            }
          </button>
        </form>
      </div>

      {/* Global chat CSS (injected once) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .msg-scrollbar::-webkit-scrollbar { width: 4px; }
        .msg-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .msg-scrollbar::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 4px; }
        .msg-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.4); }
        .msg-back-btn { display: none !important; }
        @media(max-width:768px) { .msg-back-btn { display: flex !important; } }
        .msg-bubble-wrap { animation: msg-bubble-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes msg-bubble-in {
          from { opacity:0; transform:scale(0.92) translateY(6px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .msg-send-btn:hover:not(:disabled) { transform: scale(1.06); }
        .msg-send-btn:active:not(:disabled) { transform: scale(0.95); }
        .msg-pulse { animation: msg-pulse-anim 1.6s ease-in-out infinite; }
        @keyframes msg-pulse-anim { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes msg-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
