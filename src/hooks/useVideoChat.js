import { useState, useRef, useEffect, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

const getSocketToken = () =>
  sessionStorage.getItem("teacherToken") ||
  sessionStorage.getItem("studentToken") ||
  sessionStorage.getItem("adminToken") ||
  localStorage.getItem("teacherToken") ||
  localStorage.getItem("studentToken") ||
  localStorage.getItem("adminToken");

/**
 * Manages the Socket.IO connection, live chat, and emoji reactions for a call.
 * @param {string} channelName - Agora channel / room name.
 * @param {string} userName    - Display name of the local user.
 */
export function useVideoChat(channelName, userName) {
  // ── Chat ──────────────────────────────────────────────────────────────────
  const [showChat,    setShowChat]    = useState(false);
  const [chatInput,   setChatInput]   = useState("");
  const [messages,    setMessages]    = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const showChatRef    = useRef(false);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (showChat) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showChat]);

  // ── Reactions ─────────────────────────────────────────────────────────────
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingEmojis,  setFloatingEmojis]  = useState([]);

  // ── Socket ────────────────────────────────────────────────────────────────
  const socketRef = useRef(null);

  useEffect(() => {
    const sock = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token: getSocketToken() },
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      sock.emit("join-reactions", { channelName });
      sock.emit("join-chat",      { channelName });
    });

    sock.on("emoji-reaction", ({ emoji }) => spawnFloatingEmoji(emoji));

    sock.on("chat-message", ({ id, text, senderName, timestamp }) => {
      setMessages(prev => [...prev, { id, text, senderName, timestamp, fromSelf: false }]);
      if (!showChatRef.current) setUnreadCount(c => c + 1);
    });

    return () => { sock.disconnect(); socketRef.current = null; };
  }, [channelName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Floating emoji ────────────────────────────────────────────────────────
  const spawnFloatingEmoji = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    const x  = 15 + Math.random() * 70;
    setFloatingEmojis(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3200);
  }, []);

  const sendEmoji = useCallback((emoji) => {
    spawnFloatingEmoji(emoji);
    socketRef.current?.emit("emoji-reaction", { channelName, emoji });
  }, [channelName, spawnFloatingEmoji]);

  // ── Chat send ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback((e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const msg = {
      id:         Date.now() + Math.random(),
      text,
      senderName: userName,
      channelName,
      timestamp:  new Date().toISOString(),
    };
    setMessages(prev => [...prev, { ...msg, fromSelf: true }]);
    socketRef.current?.emit("chat-message", msg);
    setChatInput("");
  }, [chatInput, channelName, userName]);

  const toggleChat = useCallback(() => {
    setShowChat(v => {
      if (!v) setUnreadCount(0);
      return !v;
    });
    setShowEmojiPicker(false);
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setUnreadCount(0);
    setShowChat(false);
    setChatInput("");
    setFloatingEmojis([]);
    setShowEmojiPicker(false);
  }, []);

  return {
    // Chat
    showChat, setShowChat, chatInput, setChatInput,
    messages, unreadCount, messagesEndRef,
    sendMessage, toggleChat, resetChat,
    // Reactions
    floatingEmojis, showEmojiPicker, setShowEmojiPicker, sendEmoji,
    // Socket ref (for cleanup if needed)
    socketRef,
  };
}
