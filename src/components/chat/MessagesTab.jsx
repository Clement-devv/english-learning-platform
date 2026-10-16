// src/components/chat/MessagesTab.jsx
import React, { useEffect, useState } from "react";
import GroupChatList from "./GroupChatList";
import ChatWindow from "./ChatWindow";
import RingTab from "../ring/RingTab";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useRing } from "../../context/RingContext";
import { MessageSquare, Phone } from "lucide-react";

const TABS = [
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "ring",     label: "Ring",     icon: Phone },
];

// compact: a small preview embedded on a dashboard home page — it must not mark
// messages as seen (that would hide the "new messages" alerts the moment the
// dashboard loads).
// fill: size to the parent (a flex column) instead of the viewport — used by the
// student phone layout so the chat sits exactly between the top bar and the tab bar.
export default function MessagesTab({ userRole, onUnreadCount, compact = false, fill = false }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeTab,    setActiveTab]    = useState("messages");
  const { isDarkMode } = useDarkMode();
  const { markMessagesSeen, lastChatEvent } = useRing();

  // Dismiss the dashboard-level unread-messages banner whenever the user opens
  // the Messages tab — same pattern as RingTab calling clearMissedCalls().
  // Also on every new message while they are here: they can already see it in
  // the list, so the floating "new messages" banner must not pop up over it.
  // Per-chat unread counts on the server are untouched until the user opens
  // an individual chat.
  useEffect(() => {
    if (activeTab === "messages" && !compact) markMessagesSeen();
  }, [activeTab, lastChatEvent, markMessagesSeen, compact]);

  const handleSelectChat = (chat) => setSelectedChat(chat);
  const handleCloseChat  = () => setSelectedChat(null);
  const dark = isDarkMode;

  const C = {
    sidebar:    dark ? "var(--as-surface, #16191f)" : "var(--as-raised, #f8f9ff)",
    border:     dark ? "rgba(255,255,255,0.06)" : "var(--as-line, #eff0f6)",
    tabBg:      dark ? "var(--as-bg, #111318)" : "var(--as-surface, #ffffff)",
    tabActive:  "var(--as-accent, #6366f1)",
    tabText:    dark ? "var(--as-muted, #8b91b8)" : "var(--as-muted, #9ea3be)",
    tabTextOn:  dark ? "var(--as-ink, #e8eaf6)" : "var(--as-ink, #1a1d2e)",
  };

  return (
    <>
      <style>{css}</style>
      <div
        className={`msg-shell${fill ? " msg-shell--fill" : ""}`}
        style={{
          display: "flex",
          ...(fill ? { flex: 1, height: "100%", minHeight: 0 } : { height: "calc(100vh - 180px)", minHeight: "520px" }),
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: dark ? "0 24px 64px rgba(0,0,0,0.5)" : "0 8px 40px rgba(0,0,0,0.10)",
          background: dark ? "var(--as-bg, #111318)" : "var(--as-surface, #ffffff)",
          border: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid var(--as-line, #e8eaf0)",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* ── Left sidebar ── */}
        <div
          className={`msg-sidebar ${selectedChat && activeTab === "messages" ? "msg-sidebar--hidden" : ""}`}
          style={{
            width: "320px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0, // lets the contact list scroll inside the sidebar
            borderRight: `1px solid ${C.border}`,
            background: C.sidebar,
          }}
        >
          {/* Tab bar */}
          <div style={{
            display: "flex",
            borderBottom: `1px solid ${C.border}`,
            background: C.tabBg,
            flexShrink: 0,
          }}>
            {TABS.map(tab => {
              const on = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedChat(null); }}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    padding: "13px 8px",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "12.5px", fontWeight: on ? "800" : "600",
                    color: on ? C.tabActive : C.tabText,
                    borderBottom: on ? `2.5px solid ${C.tabActive}` : "2.5px solid transparent",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content in sidebar */}
          {activeTab === "messages" && (
            <GroupChatList
              userRole={userRole}
              onSelectChat={handleSelectChat}
              selectedChatId={selectedChat?._id}
              isDark={dark}
              onUnreadCount={onUnreadCount}
            />
          )}

          {activeTab === "ring" && (
            <RingTab isDark={dark} />
          )}
        </div>

        {/* ── Main panel (only shown for messages tab) ── */}
        {activeTab === "messages" && (
          <div className={`msg-main${selectedChat ? "" : " msg-main--idle"}`} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
            {selectedChat ? (
              <ChatWindow
                chat={selectedChat}
                chatType={selectedChat._chatType || "group"}
                userRole={userRole}
                onClose={handleCloseChat}
                isDark={dark}
              />
            ) : (
              <EmptyState dark={dark} />
            )}
          </div>
        )}

        {/* Ring tab: full width main area shows empty placeholder on desktop */}
        {activeTab === "ring" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: dark
              ? "radial-gradient(ellipse at 50% 40%,color-mix(in srgb, var(--as-accent, #6366f1) 6%, transparent) 0%,transparent 65%)"
              : "radial-gradient(ellipse at 50% 40%,color-mix(in srgb, var(--as-accent, #6366f1) 4%, transparent) 0%,transparent 65%)",
          }} className="msg-ring-main">
            <div style={{
              width: "88px", height: "88px", borderRadius: "28px",
              background: dark
                ? "linear-gradient(135deg,var(--as-accent, #6366f1),var(--as-accent-2, #8b5cf6))"
                : "linear-gradient(135deg,var(--as-accent-soft, #e0e7ff),var(--as-accent-soft, #ede9fe))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: dark ? "0 16px 40px color-mix(in srgb, var(--as-accent, #6366f1) 35%, transparent)" : "0 8px 24px color-mix(in srgb, var(--as-accent, #6366f1) 15%, transparent)",
              marginBottom: "16px",
            }}>
              <Phone size={36} color={dark ? "#fff" : "var(--as-accent, #6366f1)"} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "700", color: dark ? "var(--as-ink-2, #e4e6ef)" : "var(--as-ink, #1e1f2e)" }}>
              Ring a Contact
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: dark ? "var(--as-ink-2, #4e5370)" : "var(--as-muted, #a0a5be)", textAlign: "center", maxWidth: "200px", lineHeight: 1.6 }}>
              Pick someone from the list to send them a ring notification
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState({ dark }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "20px",
      background: dark
        ? "radial-gradient(ellipse at 50% 40%,color-mix(in srgb, var(--as-accent, #6366f1) 7%, transparent) 0%,transparent 65%)"
        : "radial-gradient(ellipse at 50% 40%,color-mix(in srgb, var(--as-accent, #6366f1) 4%, transparent) 0%,transparent 65%)",
    }}>
      <div className="msg-empty-orb" style={{
        width: "88px", height: "88px", borderRadius: "28px",
        background: dark
          ? "linear-gradient(135deg,var(--as-accent, #6366f1) 0%,var(--as-accent-2, #8b5cf6) 100%)"
          : "linear-gradient(135deg,var(--as-accent-soft, #e0e7ff) 0%,var(--as-accent-soft, #ede9fe) 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: dark ? "0 16px 40px color-mix(in srgb, var(--as-accent, #6366f1) 35%, transparent)" : "0 8px 24px color-mix(in srgb, var(--as-accent, #6366f1) 15%, transparent)",
      }}>
        <MessageSquare size={38} color={dark ? "#fff" : "var(--as-accent, #6366f1)"} strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: "center" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "700", color: dark ? "var(--as-ink-2, #e4e6ef)" : "var(--as-ink, #1e1f2e)" }}>
          Your Messages
        </h3>
        <p style={{ margin: 0, fontSize: "13px", color: dark ? "var(--as-ink-2, #4e5370)" : "var(--as-muted, #a0a5be)", lineHeight: "1.7", maxWidth: "210px" }}>
          Pick a conversation from the sidebar to start chatting
        </p>
      </div>
    </div>
  );
}

const css = `
  .msg-shell * { box-sizing: border-box; }
  .msg-empty-orb { animation: msg-bob 4s ease-in-out infinite; }
  @keyframes msg-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @media(max-width:768px){
    .msg-sidebar--hidden { display: none !important; }
    .msg-ring-main { display: none !important; }
    /* phones: one pane at a time, full width — the list, or the open conversation */
    .msg-sidebar { width: 100% !important; border-right: none !important; }
    .msg-sidebar:not(.msg-sidebar--hidden) ~ .msg-main--idle { display: none !important; }
    .msg-shell--fill { border-radius: 20px !important; }
  }
  @media(min-width:769px){
    .msg-sidebar { display: flex !important; }
  }
`;
