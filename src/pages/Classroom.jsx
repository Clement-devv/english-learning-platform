// src/pages/Classroom.jsx - COPY THIS ENTIRE FILE
import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, MessageCircle, Users } from "lucide-react";
import VideoCall from "./VideoCall";

export default function Classroom({ classData, userRole, onLeave }) {
  const [showChat, setShowChat] = useState(true);
  
  const userInfo = JSON.parse(
    localStorage.getItem('teacherInfo') || 
    localStorage.getItem('studentInfo') || 
    '{}'
  );
  
  const userId = userInfo._id || userInfo.id || Date.now();
  const userName = `${userInfo.firstName || 'User'} ${userInfo.lastName || userInfo.surname || ''}`.trim();
  const channelName = classData?.id || classData?.title?.replace(/\s+/g, '-') || `class-${Date.now()}`;

  console.log('🎓 Classroom opened:', { classData, userId, userName, channelName });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
    >
      <div className="flex justify-between items-center bg-gray-800 text-white px-5 py-3">
        <div>
          <h2 className="text-lg font-semibold">
            🎓 {classData?.title || "Virtual Classroom"}
          </h2>
          {classData?.topic && (
            <p className="text-sm text-gray-300">{classData.topic}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {classData?.students && (
            <div className="flex items-center gap-2 text-gray-300">
              <Users className="w-4 h-4" />
              <span className="text-sm">
                {classData.students.length} student{classData.students.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          
          <button
            onClick={onLeave}
            className="p-2 rounded-lg bg-red-500 hover:bg-red-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <VideoCall 
            channelName={channelName}
            userId={userId}
            userName={userName}
            onLeave={onLeave}
          />
        </div>

        {showChat && (
          <motion.div 
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col"
          >
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Class Chat
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {classData?.students && classData.students.length > 0 && (
                <div className="bg-gray-700 rounded-lg p-3">
                  <p className="text-gray-300 text-sm font-semibold mb-2">
                    Students:
                  </p>
                  {classData.students.map((student, index) => (
                    <p key={index} className="text-gray-400 text-sm">
                      • {student}
                    </p>
                  ))}
                </div>
              )}
              
              <div className="text-gray-500 text-sm text-center mt-8">
                💬 Chat coming soon!
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700">
              <input
                type="text"
                placeholder="Type a message... (coming soon)"
                disabled
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 text-sm outline-none opacity-50 cursor-not-allowed"
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
