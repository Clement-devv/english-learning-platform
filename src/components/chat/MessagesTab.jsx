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

export default function MessagesTab({ userRole, onUnreadCount }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeTab,    setActiveTab]    = useState("messages");
  const { isDarkMode } = useDarkMode();
  const { markMessagesSeen } = useRing();

  // Dismiss the dashboard-level unread-messages banner whenever the user opens
  // the Messages tab — same pattern as RingTab calling clearMissedCalls().
  // Per-chat unread counts on the server are untouched until the user opens
  // an individual chat.
  useEffect(() => {
    if (activeTab === "messages") markMessagesSeen();
  }, [activeTab, markMessagesSeen]);

  const handleSelectChat = (chat) => setSelectedChat(chat);
  const handleCloseChat  = () => setSelectedChat(null);
  const dark = isDarkMode;

  const C = {
    sidebar:    dark ? "#16191f" : "#f8f9ff",
    border:     dark ? "rgba(255,255,255,0.06)" : "#eff0f6",
    tabBg:      dark ? "#111318" : "#ffffff",
    tabActive:  "#6366f1",
    tabText:    dark ? "#8b91b8" : "#9ea3be",
    tabTextOn:  dark ? "#e8eaf6" : "#1a1d2e",
  };

  return (
    <>
      <style>{css}</style>
      <div
        className="msg-shell"
        style={{
          display: "flex",
          height: "calc(100vh - 180px)",
          minHeight: "520px",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: dark ? "0 24px 64px rgba(0,0,0,0.5)" : "0 8px 40px rgba(0,0,0,0.10)",
          background: dark ? "#111318" : "#ffffff",
          border: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e8eaf0",
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
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
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
              ? "radial-gradient(ellipse at 50% 40%,rgba(99,102,241,.06) 0%,transparent 65%)"
              : "radial-gradient(ellipse at 50% 40%,rgba(99,102,241,.04) 0%,transparent 65%)",
          }} className="msg-ring-main">
            <div style={{
              width: "88px", height: "88px", borderRadius: "28px",
              background: dark
                ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                : "linear-gradient(135deg,#e0e7ff,#ede9fe)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: dark ? "0 16px 40px rgba(99,102,241,.35)" : "0 8px 24px rgba(99,102,241,.15)",
              marginBottom: "16px",
            }}>
              <Phone size={36} color={dark ? "#fff" : "#6366f1"} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "700", color: dark ? "#e4e6ef" : "#1e1f2e" }}>
              Ring a Contact
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: dark ? "#4e5370" : "#a0a5be", textAlign: "center", maxWidth: "200px", lineHeight: 1.6 }}>
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
        ? "radial-gradient(ellipse at 50% 40%,rgba(99,102,241,.07) 0%,transparent 65%)"
        : "radial-gradient(ellipse at 50% 40%,rgba(99,102,241,.04) 0%,transparent 65%)",
    }}>
      <div className="msg-empty-orb" style={{
        width: "88px", height: "88px", borderRadius: "28px",
        background: dark
          ? "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)"
          : "linear-gradient(135deg,#e0e7ff 0%,#ede9fe 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: dark ? "0 16px 40px rgba(99,102,241,.35)" : "0 8px 24px rgba(99,102,241,.15)",
      }}>
        <MessageSquare size={38} color={dark ? "#fff" : "#6366f1"} strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: "center" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "700", color: dark ? "#e4e6ef" : "#1e1f2e" }}>
          Your Messages
        </h3>
        <p style={{ margin: 0, fontSize: "13px", color: dark ? "#4e5370" : "#a0a5be", lineHeight: "1.7", maxWidth: "210px" }}>
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
  }
  @media(min-width:769px){
    .msg-sidebar { display: flex !important; }
  }
`;
