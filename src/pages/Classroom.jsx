import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Layout,
  Users,
  MessageCircle,
  PenTool,
  Monitor,
  X,
} from "lucide-react";

export default function Classroom({ cls, onClose }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [layout, setLayout] = useState("teacher-dominant"); // teacher-dominant | equal
  const [showChat, setShowChat] = useState(true);
  const [showBoard, setShowBoard] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 z-50 bg-gray-900/90 flex flex-col ${
        fullscreen ? "p-0" : "p-4"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center bg-gray-800 text-white px-5 py-3 rounded-t-xl">
        <h2 className="text-lg font-semibold">
          🎓 {cls?.title || "Virtual Classroom"}
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-red-500 hover:bg-red-600 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Classroom Area */}
      <div className="flex flex-1 overflow-hidden bg-gray-950 rounded-b-xl">
        {/* Left Section - Video & Board */}
        <div className="flex-1 flex flex-col">
          {/* Video Section */}
          <div
            className={`flex-1 grid ${
              layout === "equal"
                ? "grid-cols-2"
                : "grid-cols-[2fr_1fr]"
            } gap-2 p-2`}
          >
            {/* Teacher Video */}
            <div className="relative bg-black rounded-xl overflow-hidden flex items-center justify-center text-white">
              <span className="absolute top-2 left-2 bg-gray-800/70 text-xs px-2 py-1 rounded">
                Teacher
              </span>
              {camOn ? (
                <Video className="w-12 h-12 opacity-70" />
              ) : (
                <VideoOff className="w-12 h-12 opacity-70" />
              )}
            </div>

            {/* Student Video */}
            <div className="relative bg-black rounded-xl overflow-hidden flex items-center justify-center text-white">
              <span className="absolute top-2 left-2 bg-gray-800/70 text-xs px-2 py-1 rounded">
                Student
              </span>
              <Users className="w-12 h-12 opacity-70" />
            </div>
          </div>

          {/* Optional Whiteboard */}
          {showBoard && (
            <div className="bg-white flex-1 rounded-xl m-2 shadow-inner flex items-center justify-center">
              <p className="text-gray-500 text-sm">🧑‍🏫 Interactive Whiteboard Area</p>
            </div>
          )}
        </div>

        {/* Right Section - Chat */}
        {showChat && (
          <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700 text-white font-medium">
              💬 Class Chat
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-gray-300 text-sm">
              <p className="text-gray-500 italic">No messages yet.</p>
            </div>
            <div className="p-3 border-t border-gray-700">
              <input
                type="text"
                placeholder="Type a message..."
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="flex items-center justify-center gap-4 bg-gray-800 text-white py-3 rounded-b-xl">
        {/* Mic */}
        <button
          onClick={() => setMicOn(!micOn)}
          className={`p-3 rounded-full ${
            micOn ? "bg-gray-700" : "bg-red-600"
          }`}
        >
          {micOn ? <Mic /> : <MicOff />}
        </button>

        {/* Camera */}
        <button
          onClick={() => setCamOn(!camOn)}
          className={`p-3 rounded-full ${
            camOn ? "bg-gray-700" : "bg-red-600"
          }`}
        >
          {camOn ? <Video /> : <VideoOff />}
        </button>

        {/* Whiteboard */}
        <button
          onClick={() => setShowBoard(!showBoard)}
          className="p-3 rounded-full bg-gray-700"
        >
          <PenTool />
        </button>

        {/* Chat */}
        <button
          onClick={() => setShowChat(!showChat)}
          className="p-3 rounded-full bg-gray-700"
        >
          <MessageCircle />
        </button>

        {/* Layout switch */}
        <button
          onClick={() =>
            setLayout((prev) =>
              prev === "equal" ? "teacher-dominant" : "equal"
            )
          }
          className="p-3 rounded-full bg-gray-700"
        >
          <Layout />
        </button>

        {/* Fullscreen */}
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-3 rounded-full bg-gray-700"
        >
          {fullscreen ? <Minimize2 /> : <Maximize2 />}
        </button>
      </div>
    </motion.div>
  );
}
