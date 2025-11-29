// src/components/chat/ChatWindow.jsx - ✅ BEAUTIFUL UI WITH COLORS & SMOOTH SCROLLING
import React, { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft, Users, Loader, Paperclip, Smile, MoreVertical, Phone, Video, Search } from "lucide-react";
import api from "../../api";
import { useDarkMode } from "../../hooks/useDarkMode";

export default function ChatWindow({ chat, userRole, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const { isDarkMode } = useDarkMode();

  // 🎨 Color palette for different user types
  const roleColors = {
    admin: {
      bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      text: 'text-white',
      name: 'text-purple-600',
      badge: 'bg-purple-100 text-purple-700'
    },
    teacher: {
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      text: 'text-white',
      name: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700'
    },
    student: {
      bg: 'bg-gradient-to-br from-green-500 to-green-600',
      text: 'text-white',
      name: 'text-green-600',
      badge: 'bg-green-100 text-green-700'
    }
  };

  // Fetch messages when chat changes
  useEffect(() => {
    if (chat?._id) {
      fetchMessages();
      markAsRead();
      
      // Poll for new messages every 5 seconds
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [chat?._id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    if (!chat?._id) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/api/group-chats/${chat._id}/messages`);
      
      // Handle different response formats
      let fetchedMessages = [];
      if (response.data.messages) {
        fetchedMessages = response.data.messages;
      } else if (Array.isArray(response.data)) {
        fetchedMessages = response.data;
      }
      
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!chat?._id) return;
    
    try {
      await api.patch(`/api/group-chats/${chat._id}/mark-read`);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;
    
    try {
      setSending(true);
      
      const response = await api.post(`/api/group-chats/${chat._id}/messages`, {
        message: newMessage.trim()
      });

      if (response.data.success) {
        // Add the new message to the list
        setMessages(prev => [...prev, response.data.data]);
        setNewMessage("");
        scrollToBottom();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) {
      return "Today";
    } else if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return d.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!chat) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* 🎨 ENHANCED HEADER */}
      <div className={`${
        isDarkMode 
          ? 'bg-gradient-to-r from-gray-800 via-gray-800 to-gray-800 border-gray-700' 
          : 'bg-gradient-to-r from-white via-gray-50 to-white border-gray-200'
      } border-b px-4 py-3 shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button (mobile) */}
            {onClose && (
              <button
                onClick={onClose}
                className={`md:hidden p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            {/* Avatar */}
            <div className="relative">
              <div className={`w-10 h-10 rounded-full ${
                isDarkMode ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-blue-400 to-purple-500'
              } flex items-center justify-center text-white font-semibold shadow-md`}>
                <Users className="w-5 h-5" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            
            {/* Chat Info */}
            <div className="flex-1 min-w-0">
              <h2 className={`font-semibold text-base truncate ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {chat.chatName || "Unnamed Chat"}
              </h2>
              <p className={`text-xs flex items-center gap-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {messages.length} messages
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <Search className="w-5 h-5" />
            </button>
            <button className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <Phone className="w-5 h-5" />
            </button>
            <button className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <Video className="w-5 h-5" />
            </button>
            <button className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 🎨 MESSAGES WITH PROPER SCROLLING */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{
          scrollBehavior: 'smooth',
          overflowX: 'hidden' // Prevent horizontal scroll
        }}
      >
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader className="w-8 h-8 animate-spin text-blue-500" />
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
              Loading messages...
            </p>
          </div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div className={`w-20 h-20 rounded-full ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
            } flex items-center justify-center mb-4`}>
              <Smile className="w-10 h-10" />
            </div>
            <p className="text-center text-lg font-medium">No messages yet</p>
            <p className="text-center text-sm mt-1">Start the conversation!</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* 🎨 DATE SEPARATOR */}
              <div className="flex items-center gap-3 my-6">
                <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isDarkMode 
                    ? 'bg-gray-800 text-gray-400' 
                    : 'bg-white text-gray-600 shadow-sm'
                }`}>
                  {date}
                </div>
                <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              </div>

              {/* 🎨 MESSAGES WITH COLORS */}
              {dateMessages.map((msg, idx) => {
                const isOwnMessage = msg.senderRole === userRole;
                const colors = roleColors[msg.senderRole] || roleColors.student;
                
                return (
                  <div
                    key={msg._id || idx}
                    className={`flex items-end gap-2 mb-4 ${
                      isOwnMessage ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar (only for others' messages) */}
                    {!isOwnMessage && (
                      <div className={`${colors.bg} w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-md`}>
                        {getInitials(msg.senderName)}
                      </div>
                    )}
                    
                    {/* Message Content */}
                    <div className={`flex flex-col max-w-[75%] md:max-w-[60%] ${
                      isOwnMessage ? 'items-end' : 'items-start'
                    }`}>
                      {/* Sender name (only for others' messages) */}
                      {!isOwnMessage && (
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className={`text-xs font-semibold ${colors.name}`}>
                            {msg.senderName}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.badge} font-medium uppercase`}>
                            {msg.senderRole}
                          </span>
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div
                        className={`relative px-4 py-2.5 rounded-2xl shadow-sm ${
                          isOwnMessage
                            ? `${colors.bg} ${colors.text} rounded-br-md`
                            : isDarkMode
                              ? 'bg-gray-800 text-white rounded-bl-md'
                              : 'bg-white text-gray-900 rounded-bl-md border border-gray-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {msg.message}
                        </p>
                        
                        {/* Time */}
                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${
                          isOwnMessage 
                            ? 'text-white/80' 
                            : isDarkMode 
                              ? 'text-gray-400' 
                              : 'text-gray-500'
                        }`}>
                          <span>{formatTime(msg.createdAt)}</span>
                          {isOwnMessage && (
                            <>
                              <span>•</span>
                              <span>✓✓</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 🎨 ENHANCED INPUT */}
      <div className={`${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      } border-t px-4 py-3 shadow-lg`}>
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* Attachment Button */}
          <button
            type="button"
            className={`p-2.5 rounded-xl transition-all ${
              isDarkMode 
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type a message..."
              disabled={sending}
              rows={1}
              className={`w-full px-4 py-3 rounded-2xl resize-none ${
                isDarkMode 
                  ? 'bg-gray-700 text-white placeholder-gray-400 focus:bg-gray-600' 
                  : 'bg-gray-100 text-gray-900 placeholder-gray-500 focus:bg-gray-50'
              } border-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all`}
              style={{
                minHeight: '44px',
                maxHeight: '120px'
              }}
            />
            
            {/* Emoji Button */}
            <button
              type="button"
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all ${
                isDarkMode 
                  ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
              }`}
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`p-3 rounded-xl font-medium transition-all shadow-md ${
              !newMessage.trim() || sending
                ? isDarkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/25 hover:shadow-lg hover:scale-105 active:scale-95'
            }`}
          >
            {sending ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        
        {/* Typing Indicator (Optional) */}
        <div className={`text-xs mt-2 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {/* You can add "Someone is typing..." here */}
        </div>
      </div>
    </div>
  );
}
