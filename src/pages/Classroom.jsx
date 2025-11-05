// src/pages/Classroom.jsx - ENHANCED WITH SPLIT-SCREEN & WHITEBOARD
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Users, Palette, Video } from "lucide-react";
import VideoCall from "./VideoCall";
import SharedWhiteboard from "../components/SharedWhiteboard";
import EmojiReactions from "../components/EmojiReactions";

export default function Classroom({ classData, userRole, onLeave }) {
  const [showChat, setShowChat] = useState(true);
  const [showWhiteboard, setShowWhiteboard] = useState(true);
  const [videoMaximized, setVideoMaximized] = useState(false);
  const [whiteboardMaximized, setWhiteboardMaximized] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const userInfo = JSON.parse(
    localStorage.getItem('teacherInfo') || 
    localStorage.getItem('studentInfo') || 
    '{}'
  );
  
  const userId = userInfo._id || userInfo.id || Date.now();
  const userName = `${userInfo.firstName || 'User'} ${userInfo.lastName || userInfo.surname || ''}`.trim();
  const channelName = classData?.id || classData?.title?.replace(/\s+/g, '-') || `class-${Date.now()}`;

  console.log('🎓 Classroom opened:', { classData, userId, userName, channelName });

  const toggleVideoMaximize = () => {
    setVideoMaximized(!videoMaximized);
    if (!videoMaximized) {
      setWhiteboardMaximized(false);
    }
  };

  const toggleWhiteboardMaximize = () => {
    setWhiteboardMaximized(!whiteboardMaximized);
    if (!whiteboardMaximized) {
      setVideoMaximized(false);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        text: newMessage,
        sender: userName,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages([...chatMessages, message]);
      setNewMessage('');
      
      // TODO: Send via socket.io
      // socket.emit('chat-message', message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 shadow-lg">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🎓 {classData?.title || "Virtual Classroom"}
          </h2>
          {classData?.topic && (
            <p className="text-sm text-purple-100">{classData.topic}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {classData?.students && (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                {classData.students.length} student{classData.students.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          
          <button
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className={`p-2 rounded-lg transition ${
              showWhiteboard ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
            }`}
            title="Toggle Whiteboard"
          >
            <Palette className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-lg transition ${
              showChat ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
            }`}
            title="Toggle Chat"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          
          <button
            onClick={onLeave}
            className="p-2 rounded-lg bg-red-500 hover:bg-red-600 transition"
            title="Leave Class"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Split Screen Layout */}
        <div className={`flex-1 flex ${showWhiteboard ? 'flex-row' : ''} transition-all`}>
          {/* Video Call Section */}
          <AnimatePresence>
            {(!whiteboardMaximized || !showWhiteboard) && (
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className={`${
                  videoMaximized 
                    ? 'w-full' 
                    : showWhiteboard 
                      ? 'w-1/2' 
                      : 'w-full'
                } transition-all duration-300`}
              >
                <VideoCall 
                  channelName={channelName}
                  userId={userId}
                  userName={userName}
                  onLeave={onLeave}
                  isMaximized={videoMaximized}
                  onToggleMaximize={showWhiteboard ? toggleVideoMaximize : null}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Whiteboard Section */}
          <AnimatePresence>
            {showWhiteboard && !videoMaximized && (
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className={`${
                  whiteboardMaximized ? 'w-full' : 'w-1/2'
                } border-l-2 border-gray-700 transition-all duration-300`}
              >
                  <SharedWhiteboard 
                  isMaximized={whiteboardMaximized}
                  onToggleMaximize={toggleWhiteboardMaximize}
                  channelName={channelName}
                  userId={userId}
                  userName={userName}
                  userRole={userRole}
                />

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="w-80 bg-gray-800 border-l-2 border-gray-700 flex flex-col"
            >
              <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-purple-600 to-blue-600">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Class Chat
                </h3>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {classData?.students && classData.students.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-gray-300 text-sm font-semibold mb-2">
                      👥 Students in class:
                    </p>
                    {classData.students.map((student, index) => (
                      <p key={index} className="text-gray-400 text-sm">
                        • {student}
                      </p>
                    ))}
                  </div>
                )}

                {chatMessages.length === 0 && (
                  <div className="text-gray-500 text-sm text-center mt-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                    <p>No messages yet</p>
                    <p className="text-xs mt-1">Start the conversation!</p>
                  </div>
                )}

                {chatMessages.map((msg) => (
                  <div key={msg.id} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-blue-400 text-sm font-semibold">
                        {msg.sender}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="text-gray-200 text-sm">{msg.text}</p>
                  </div>
                ))}
              </div>
              
              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition"
                  >
                    Send
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Emoji Reactions */}
      <div className="fixed bottom-6 right-6 z-50">
        <EmojiReactions />
      </div>

      {/* Instructions for Children */}
      {userRole === 'student' && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
          className="fixed bottom-20 left-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 rounded-full shadow-lg text-sm"
        >
          👉 Click the smiley face to send fun reactions! 🎉
        </motion.div>
      )}
    </motion.div>
  );
}
