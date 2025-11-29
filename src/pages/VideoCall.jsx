// src/pages/VideoCall_TABS.jsx - 🎥 VIDEO COMPONENT FOR TABBED INTERFACE
import React, { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import api from "../api";
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff, 
  Monitor,
  MonitorOff,
  Users,
  Loader,
  Smile
} from "lucide-react";

export default function VideoCall({ 
  channelName, 
  userId, 
  userName = "User", 
  onLeave,
  onUserJoined,
  onUserLeft,
  mode = "video" // "video" | "content" | "whiteboard"
}) {
  const client = useRef(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [screenTrack, setScreenTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // 😊 Emoji reaction state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmoji, setActiveEmoji] = useState(null);
  
  const localContainer = useRef();
  const remoteContainerRef = useRef({});
  
  // 🔒 Prevent multiple join attempts
  const isJoiningRef = useRef(false);
  const hasJoinedRef = useRef(false);
  
  const onUserJoinedRef = useRef(onUserJoined);
  const onUserLeftRef = useRef(onUserLeft);

  useEffect(() => {
    onUserJoinedRef.current = onUserJoined;
    onUserLeftRef.current = onUserLeft;
  }, [onUserJoined, onUserLeft]);

  const handleUserPublished = useCallback(async (user, mediaType) => {
    console.log(`👤 User ${user.uid} published ${mediaType}`);
    
    try {
      await client.current.subscribe(user, mediaType);
      console.log(`✅ Subscribed to ${mediaType}`);
      
      if (mediaType === "video") {
        setRemoteUsers(prev => {
          const exists = prev.find(u => u.uid === user.uid);
          if (exists) return prev;
          
          if (onUserJoinedRef.current) {
            console.log('📢 Calling onUserJoined callback');
            onUserJoinedRef.current(user.uid);
          }
          
          return [...prev, user];
        });
        
        setTimeout(() => {
          const container = remoteContainerRef.current[user.uid];
          if (container && user.videoTrack) {
            user.videoTrack.play(container);
            console.log('🎥 Playing video');
          }
        }, 100);
      }
      
      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
    } catch (error) {
      console.error("❌ Subscribe error:", error);
    }
  }, []);

  const handleUserUnpublished = useCallback((user, mediaType) => {
    if (mediaType === "video") {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    }
  }, []);

  const handleUserLeft = useCallback((user) => {
    console.log(`👋 User ${user.uid} left channel`);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    
    if (onUserLeftRef.current) {
      onUserLeftRef.current(user.uid);
    }
  }, []);

  const handleConnectionChange = useCallback((currentState, prevState) => {
    console.log(`🔌 Connection: ${prevState} -> ${currentState}`);
    if (currentState === "DISCONNECTED") {
      setError("Connection lost. Please rejoin the call.");
      setJoined(false);
    }
  }, []);

  useEffect(() => {
    if (!client.current) {
      console.log('🔧 Initializing Agora client');
      
      client.current = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" 
      });

      client.current.on("user-published", handleUserPublished);
      client.current.on("user-unpublished", handleUserUnpublished);
      client.current.on("user-left", handleUserLeft);
      client.current.on("connection-state-change", handleConnectionChange);
      
      console.log('✅ Event listeners registered');
    }
    
    return () => {
      if (joined && client.current) {
        cleanup();
      }
    };
  }, [handleUserPublished, handleUserUnpublished, handleUserLeft, handleConnectionChange, joined]);

  // Auto-join on component mount
  useEffect(() => {
    if (!joined && !loading && !isJoiningRef.current && !hasJoinedRef.current) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        joinCall();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, []); // Only run once on mount

  const joinCall = async () => {
    // 🔒 Prevent multiple join attempts
    if (isJoiningRef.current || hasJoinedRef.current || joined) {
      console.log('⚠️ Already joining or joined, skipping...');
      return;
    }

    try {
      isJoiningRef.current = true;
      setLoading(true);
      setError(null);

      console.log(`🚀 JOINING AGORA CHANNEL: ${channelName}`);

      // 🔧 FIX: Add random suffix for testing with same account
      // Remove this in production - each user should have unique userId
      const testUID = userId + '-' + Math.random().toString(36).substr(2, 9);
      console.log('🔑 Using UID:', testUID, '(original:', userId, ')');

      const { data } = await api.get(
        `/api/agora/token?channel=${channelName}&uid=${testUID}`
      );

      if (!data.success) {
        throw new Error(data.message || 'Failed to get authentication token');
      }

      await client.current.join(data.appId, channelName, data.token, data.uid);
      console.log('✅ Joined channel with UID:', data.uid);

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks({
        audioConfig: { 
          encoderConfig: "music_standard",
          ANS: true,
          AEC: true
        },
        videoConfig: { 
          encoderConfig: "720p_2",
          optimizationMode: "detail"
        },
      });
      
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      if (localContainer.current) {
        videoTrack.play(localContainer.current);
      }

      await client.current.publish([audioTrack, videoTrack]);
      console.log('✅ Published local tracks');
      
      hasJoinedRef.current = true;
      setJoined(true);
      
    } catch (err) {
      console.error('❌ JOIN ERROR:', err);
      
      let errorMessage = 'Failed to join call';
      
      if (err.code === 'INVALID_OPERATION') {
        errorMessage = 'Already connected. Please refresh the page.';
      } else if (err.message.includes('camera') || err.message.includes('microphone')) {
        errorMessage = 'Unable to access camera/microphone. Please check permissions.';
      } else if (err.code === 'INVALID_TOKEN') {
        errorMessage = 'Session expired. Please refresh and try again.';
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
      hasJoinedRef.current = false;
    } finally {
      setLoading(false);
      isJoiningRef.current = false;
    }
  };

  const leaveCall = async () => {
    if (!joined) return;

    try {
      console.log('👋 Leaving call...');
      
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      if (screenTrack) {
        screenTrack.stop();
        screenTrack.close();
      }

      if (client.current) {
        await client.current.leave();
      }
      
      // Reset all flags
      setJoined(false);
      hasJoinedRef.current = false;
      isJoiningRef.current = false;
      
      setRemoteUsers([]);
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      setScreenTrack(null);
      setIsScreenSharing(false);
      setMicOn(true);
      setCamOn(true);
      
      if (onLeave) onLeave();
      
    } catch (err) {
      console.error('❌ Leave call error:', err);
    }
  };

  const cleanup = async () => {
    await leaveCall();
    if (client.current) {
      client.current.removeAllListeners();
      client.current = null;
    }
  };

  const toggleMic = async () => {
    if (localAudioTrack) {
      const newState = !micOn;
      await localAudioTrack.setEnabled(newState);
      setMicOn(newState);
    }
  };

  const toggleCamera = async () => {
    if (localVideoTrack) {
      const newState = !camOn;
      await localVideoTrack.setEnabled(newState);
      setCamOn(newState);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screen = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p_1",
          optimizationMode: "detail"
        });
        
        if (localVideoTrack && camOn) {
          await client.current.unpublish([localVideoTrack]);
          localVideoTrack.stop();
        }
        
        await client.current.publish([screen]);
        
        if (localContainer.current) {
          screen.play(localContainer.current);
        }
        
        setScreenTrack(screen);
        setIsScreenSharing(true);
        
        screen.on("track-ended", () => {
          toggleScreenShare();
        });
        
      } else {
        if (screenTrack) {
          await client.current.unpublish([screenTrack]);
          screenTrack.stop();
          screenTrack.close();
          setScreenTrack(null);
        }
        
        if (localVideoTrack && camOn) {
          await client.current.publish([localVideoTrack]);
          if (localContainer.current) {
            localVideoTrack.play(localContainer.current);
          }
        }
        
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('❌ Screen share error:', error);
      setError('Screen sharing failed. Please try again.');
      setIsScreenSharing(false);
    }
  };

  // 😊 Emoji reactions
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🤔'];
  
  const sendEmoji = (emoji) => {
    setActiveEmoji(emoji);
    setShowEmojiPicker(false);
    setTimeout(() => setActiveEmoji(null), 3000);
  };

  // 🎨 RENDER BASED ON MODE
  if (mode === "video") {
    // FULL VIDEO VIEW - Two large video boxes
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        
        {/* 🎥 LARGE VIDEO AREAS */}
        <div className="flex-1 p-4 flex gap-4">
          
          {/* Local Video - ALWAYS SHOW (even when not joined) */}
          <div className="flex-1 relative bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
            {joined ? (
              <>
                <div ref={localContainer} className="w-full h-full" />
                
                {/* User label */}
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
                  <span className="font-bold text-purple-700">{userName} (You)</span>
                </div>

                {/* Status icons */}
                <div className="absolute top-4 right-4 flex gap-2">
                  {!micOn && (
                    <div className="bg-red-500 p-2 rounded-full animate-pulse">
                      <MicOff className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {!camOn && (
                    <div className="bg-red-500 p-2 rounded-full animate-pulse">
                      <VideoOff className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {isScreenSharing && (
                    <div className="bg-blue-500 p-2 rounded-full">
                      <Monitor className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Active Emoji */}
                {activeEmoji && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <span className="text-9xl animate-bounce drop-shadow-2xl">{activeEmoji}</span>
                  </div>
                )}
              </>
            ) : (
              /* Loading/Connecting state */
              <div className="w-full h-full flex flex-col items-center justify-center">
                {loading ? (
                  <>
                    <Loader className="w-16 h-16 text-purple-500 animate-spin mb-4" />
                    <p className="text-xl font-bold text-purple-600">Connecting to video...</p>
                    <p className="text-sm text-purple-400 mt-2">Starting camera and microphone</p>
                  </>
                ) : (
                  <>
                    <VideoIcon className="w-16 h-16 text-purple-400 mb-4" />
                    <p className="text-xl font-bold text-purple-600">Ready to join</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Remote Video */}
          {joined && remoteUsers.length > 0 ? (
            <div className="flex-1 relative bg-gradient-to-br from-pink-100 to-purple-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              {remoteUsers.map((user) => (
                <div key={user.uid} className="w-full h-full">
                  <div 
                    ref={(el) => (remoteContainerRef.current[user.uid] = el)}
                    className="w-full h-full"
                  />
                  
                  {/* Connected badge */}
                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-bold text-purple-700">Connected</span>
                  </div>

                  <div className="absolute top-4 right-4 bg-green-500 text-white text-sm px-4 py-2 rounded-full font-bold shadow-lg animate-pulse">
                    🔴 LIVE
                  </div>
                </div>
              ))}
            </div>
          ) : joined ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl border-4 border-dashed border-yellow-300">
              <Users className="w-32 h-32 text-yellow-400 mb-4 animate-pulse" />
              <p className="text-2xl font-bold text-yellow-600">Waiting for others...</p>
              <p className="text-lg text-yellow-500 mt-2">They'll appear here when they join! 🎉</p>
            </div>
          ) : (
            /* Not joined yet - show placeholder */
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-4 border-dashed border-gray-300">
              <Users className="w-32 h-32 text-gray-400 mb-4" />
              <p className="text-2xl font-bold text-gray-600">Other participant</p>
              <p className="text-lg text-gray-500 mt-2">Will appear when connected</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mb-2 bg-red-100 border-2 border-red-300 text-red-700 px-4 py-3 rounded-2xl flex items-center justify-between">
            <span className="font-medium">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold text-lg"
            >
              ✕
            </button>
          </div>
        )}

        {/* 🎮 COLORFUL CONTROLS */}
        <div className="bg-white border-t-2 border-purple-200 p-4 shadow-lg">
          <div className="flex items-center justify-center gap-3">
            {joined && (
              <>
                {/* Mic */}
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${
                    micOn 
                      ? 'bg-gradient-to-br from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white' 
                      : 'bg-gradient-to-br from-red-400 to-red-500 text-white animate-pulse'
                  }`}
                >
                  {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>

                {/* Camera */}
                <button
                  onClick={toggleCamera}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${
                    camOn 
                      ? 'bg-gradient-to-br from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white' 
                      : 'bg-gradient-to-br from-red-400 to-red-500 text-white animate-pulse'
                  }`}
                >
                  {camOn ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>

                {/* Screen Share */}
                <button
                  onClick={toggleScreenShare}
                  className={`p-4 rounded-full shadow-lg transform hover:scale-110 transition-all ${
                    isScreenSharing
                      ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white'
                      : 'bg-gradient-to-br from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-700'
                  }`}
                >
                  {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                </button>

                {/* 😊 Emoji Picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-4 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-400 hover:from-yellow-400 hover:to-yellow-500 shadow-lg transform hover:scale-110 transition-all"
                  >
                    <Smile className="w-6 h-6 text-gray-700" />
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl shadow-2xl p-3 grid grid-cols-4 gap-2 border-2 border-yellow-300">
                      {emojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendEmoji(emoji)}
                          className="text-3xl hover:scale-125 transform transition-all p-2 hover:bg-yellow-50 rounded-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Leave Call */}
                <button
                  onClick={leaveCall}
                  className="p-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg transform hover:scale-110 transition-all"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // For "content" and "whiteboard" modes - show both videos side by side (smaller)
  return (
    <div className="h-full flex gap-4 p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Local Video */}
      {joined && (
        <div className="flex-1 relative bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl overflow-hidden shadow-xl border-4 border-white">
          <div ref={localContainer} className="w-full h-full" />
          
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg">
            <span className="font-bold text-sm text-purple-700">{userName}</span>
          </div>

          <div className="absolute top-3 right-3 flex gap-1">
            {!micOn && (
              <div className="bg-red-500 p-1.5 rounded-full">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
            {!camOn && (
              <div className="bg-red-500 p-1.5 rounded-full">
                <VideoOff className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remote Video */}
      {joined && remoteUsers.length > 0 ? (
        <div className="flex-1 relative bg-gradient-to-br from-pink-100 to-purple-100 rounded-3xl overflow-hidden shadow-xl border-4 border-white">
          {remoteUsers.map((user) => (
            <div key={user.uid} className="w-full h-full">
              <div 
                ref={(el) => (remoteContainerRef.current[user.uid] = el)}
                className="w-full h-full"
              />
              
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-bold text-sm text-purple-700">Connected</span>
              </div>

              <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                🔴 LIVE
              </div>
            </div>
          ))}
        </div>
      ) : joined ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl border-4 border-dashed border-yellow-300">
          <Users className="w-16 h-16 text-yellow-400 mb-3 animate-pulse" />
          <p className="text-lg font-bold text-yellow-600">Waiting...</p>
        </div>
      ) : null}
    </div>
  );
}
