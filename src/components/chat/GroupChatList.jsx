// src/components/chat/GroupChatList.jsx - ✅ BEAUTIFUL UI TO MATCH CHAT WINDOW
import React, { useState, useEffect } from "react";
import { MessageCircle, Search, Users, Filter, MoreVertical, Pin } from "lucide-react";
import api from "../../api";
import { useDarkMode } from "../../hooks/useDarkMode";

export default function GroupChatList({ userRole, onSelectChat, selectedChatId }) {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const { isDarkMode } = useDarkMode();

  // 🎨 Role colors for visual distinction
  const getRoleColor = (role) => {
    const colors = {
      admin: 'from-purple-500 to-purple-600',
      teacher: 'from-blue-500 to-blue-600',
      student: 'from-green-500 to-green-600'
    };
    return colors[role] || 'from-gray-500 to-gray-600';
  };

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [userRole]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/group-chats");
      
      // Handle different response formats
      let fetchedChats = [];
      
      if (response.data) {
        if (response.data.chats) {
          fetchedChats = response.data.chats;
        } else if (Array.isArray(response.data)) {
          fetchedChats = response.data;
        } else if (response.data.data) {
          fetchedChats = response.data.data;
        }
      }
      
      // Ensure fetchedChats is an array
      if (!Array.isArray(fetchedChats)) {
        console.warn("Chats data is not an array:", fetchedChats);
        fetchedChats = [];
      }
      
      // Calculate total unread count
      const totalUnread = fetchedChats.reduce((sum, chat) => {
        const unreadCount = chat?.unreadCount?.[userRole] || 0;
        return sum + unreadCount;
      }, 0);
      
      setChats(fetchedChats);
      setTotalUnreadCount(totalUnread);
      
    } catch (error) {
      console.error("Error fetching chats:", error);
      console.error("Error details:", error.response?.data);
      setChats([]);
      setTotalUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) => {
    if (!chat || !chat.chatName) return false;
    return chat.chatName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Format timestamp
  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* 🎨 ENHANCED HEADER */}
      <div className={`${
        isDarkMode 
          ? 'bg-gradient-to-r from-gray-800 via-gray-800 to-gray-800 border-gray-700' 
          : 'bg-gradient-to-r from-white via-gray-50 to-white border-gray-200'
      } border-b px-4 py-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
            }`}>
              <MessageCircle className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Messages
              </h2>
              {totalUnreadCount > 0 && (
                <p className="text-xs text-blue-500 font-medium">
                  {totalUnreadCount} unread
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <Filter className="w-5 h-5" />
            </button>
            <button className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* 🎨 SEARCH BAR */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl transition-all ${
              isDarkMode 
                ? 'bg-gray-800 text-white placeholder-gray-400 focus:bg-gray-750 border border-gray-700 focus:border-blue-500' 
                : 'bg-gray-100 text-gray-900 placeholder-gray-500 focus:bg-white border border-transparent focus:border-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          />
        </div>
      </div>

      {/* 🎨 CHAT LIST WITH SMOOTH SCROLLING */}
      <div className="flex-1 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Loading chats...
            </p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full px-4 py-12 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div className={`w-20 h-20 rounded-full ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
            } flex items-center justify-center mb-4`}>
              <MessageCircle className="w-10 h-10 opacity-50" />
            </div>
            <p className="font-medium text-center">
              {searchQuery ? "No chats found" : "No chats yet"}
            </p>
            {!searchQuery && (
              <p className="text-sm text-center mt-1">
                Chats will appear here when assignments are created
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredChats.map((chat) => {
              const isSelected = selectedChatId === chat._id;
              const unreadCount = chat.unreadCount?.[userRole] || 0;
              
              return (
                <div
                  key={chat._id}
                  onClick={() => onSelectChat(chat)}
                  className={`px-4 py-3 cursor-pointer transition-all ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-blue-500/10 border-l-4 border-blue-500'
                        : 'bg-blue-50 border-l-4 border-blue-500'
                      : isDarkMode
                        ? 'hover:bg-gray-800 border-l-4 border-transparent'
                        : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 🎨 AVATAR WITH GRADIENT */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                        getRoleColor(chat.lastMessage?.senderRole || 'teacher')
                      } flex items-center justify-center text-white font-semibold text-sm shadow-md`}>
                        {getInitials(chat.chatName)}
                      </div>
                      {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>

                    {/* 🎨 CHAT INFO */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold truncate text-sm ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        } ${unreadCount > 0 ? 'font-bold' : ''}`}>
                          {chat.chatName || "Unnamed Chat"}
                        </h3>
                        <span className={`text-xs flex-shrink-0 ml-2 ${
                          unreadCount > 0 
                            ? 'text-blue-500 font-semibold' 
                            : isDarkMode 
                              ? 'text-gray-500' 
                              : 'text-gray-400'
                        }`}>
                          {formatTime(chat.lastMessage?.timestamp || chat.lastActivityAt)}
                        </span>
                      </div>
                      
                      {chat.lastMessage ? (
                        <div className="flex items-center gap-2">
                          <p className={`text-sm truncate flex-1 ${
                            unreadCount > 0
                              ? isDarkMode ? 'text-white font-medium' : 'text-gray-900 font-medium'
                              : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            <span className="font-semibold">
                              {chat.lastMessage.senderName?.split(' ')[0]}:
                            </span>{" "}
                            {chat.lastMessage.text}
                          </p>
                        </div>
                      ) : (
                        <p className={`text-sm italic ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          No messages yet
                        </p>
                      )}
                      
                      {/* 🎨 TAGS/BADGES */}
                      {userRole === 'admin' && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                            MONITORING
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🎨 FOOTER (Optional Stats) */}
      {userRole === "admin" && chats.length > 0 && (
        <div className={`px-4 py-3 border-t text-xs text-center ${
          isDarkMode 
            ? 'border-gray-800 text-gray-500 bg-gray-800/50' 
            : 'border-gray-200 text-gray-400 bg-gray-50'
        }`}>
          <div className="flex items-center justify-center gap-4">
            <span>
              {filteredChats.length} of {chats.length} conversation{chats.length !== 1 ? 's' : ''}
            </span>
            {totalUnreadCount > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-500 font-semibold">
                  {totalUnreadCount} unread
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
