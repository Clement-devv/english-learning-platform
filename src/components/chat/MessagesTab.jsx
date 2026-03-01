// src/components/chat/MessagesTab.jsx
import React, { useState } from "react";
import GroupChatList from "./GroupChatList";
import ChatWindow from "./ChatWindow";
import { useDarkMode } from "../../hooks/useDarkMode";
import { MessageSquare } from "lucide-react";

export default function MessagesTab({ userRole }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const { isDarkMode } = useDarkMode();

  const handleSelectChat = (chat) => setSelectedChat(chat);
  const handleCloseChat  = () => setSelectedChat(null);
  const dark = isDarkMode;

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
          fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif",
        }}
      >
        {/* Sidebar */}
        <div
          className={`msg-sidebar ${selectedChat ? "msg-sidebar--hidden" : ""}`}
          style={{
            width: "320px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #eff0f6",
            background: dark ? "#16191f" : "#f8f9ff",
          }}
        >
          <GroupChatList
            userRole={userRole}
            onSelectChat={handleSelectChat}
            selectedChatId={selectedChat?._id}
            isDark={dark}
          />
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              userRole={userRole}
              onClose={handleCloseChat}
              isDark={dark}
            />
          ) : (
            <EmptyState dark={dark} />
          )}
        </div>
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
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .msg-shell * { box-sizing: border-box; }
  .msg-empty-orb { animation: msg-bob 4s ease-in-out infinite; }
  @keyframes msg-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @media(max-width:768px){
    .msg-sidebar--hidden { display: none !important; }
  }
  @media(min-width:769px){
    .msg-sidebar { display: flex !important; }
  }
`;
