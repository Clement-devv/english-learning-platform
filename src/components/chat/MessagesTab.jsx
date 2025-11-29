// src/components/chat/MessagesTab.jsx - ✅ FIXED (No JSX warning)
import React, { useState } from "react";
import GroupChatList from "./GroupChatList";
import ChatWindow from "./ChatWindow";
import { useDarkMode } from "../../hooks/useDarkMode";

export default function MessagesTab({ userRole }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const { isDarkMode } = useDarkMode();

  // Handle chat selection
  const handleSelectChat = (chat) => {
    console.log("Chat selected:", chat);
    setSelectedChat(chat);
  };

  // Handle closing chat window (for mobile)
  const handleCloseChat = () => {
    setSelectedChat(null);
  };

  return (
    <div className={`flex h-[calc(100vh-200px)] ${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
      {/* Left Panel: Chat List */}
      <div className={`${
        selectedChat ? 'hidden md:block' : 'block'
      } w-full md:w-96 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <GroupChatList
          userRole={userRole}
          onSelectChat={handleSelectChat}
          selectedChatId={selectedChat?._id}
        />
      </div>

      {/* Right Panel: Chat Window */}
      <div className={`${
        selectedChat ? 'block' : 'hidden md:block'
      } flex-1`}>
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            userRole={userRole}
            onClose={handleCloseChat}
          />
        ) : (
          <div className={`flex flex-col items-center justify-center h-full ${
            isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'
          }`}>
            {/* Message Icon SVG */}
            <svg
              className="w-24 h-24 mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className={`text-xl font-semibold mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Select a chat to start messaging
            </h3>
            <p className="text-sm">
              Choose a conversation from the list to view messages
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
