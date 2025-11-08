// src/pages/VideoCall.jsx - FULLY CORRECTED VERSION
import React, { useEffect, useRef, useState } from "react";
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
  Maximize2,
  Minimize2
} from "lucide-react";

export default function VideoCall({ 
  channelName, 
  userId, 
  userName = "User", 
  onLeave,
  isMaximized = false,
  onToggleMaximize,
  onUserJoined,    // ✅ NEW PROP
  onUserLeft       // ✅ NEW PROP
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
  
  const localContainer = useRef();
  const remoteContainerRef = useRef({});
  const isInitialized = useRef(false);

  useEffect(() => {
    console.log('🎥 VideoCall mounted:', { channelName, userId, userName });
    
    if (!isInitialized.current) {
      initializeClient();
      isInitialized.current = true;
    }
    
    return () => {
      if (joined) {
        console.log('🧹 Cleaning up joined call');
        cleanup();
      } else {
        console.log('🧹 Component unmounting (never joined)');
        if (client.current) {
          client.current.removeAllListeners();
        }
      }
    };
  }, [joined]);

  const initializeClient = () => {
    console.log('🔧 Initializing Agora client');
    
    client.current = AgoraRTC.createClient({ 
      mode: "rtc", 
      codec: "vp8" 
    });

    client.current.on("user-published", handleUserPublished);
    client.current.on("user-unpublished", handleUserUnpublished);
    client.current.on("user-left", handleUserLeft);
    client.current.on("connection-state-change", handleConnectionChange);
  };

  // ✅ FIXED: Proper callback placement
  const handleUserPublished = async (user, mediaType) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 User ${user.uid} published ${mediaType}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    try {
      await client.current.subscribe(user, mediaType);
      console.log(`✅ Subscribed to ${mediaType}`);
      
      if (mediaType === "video") {
        setRemoteUsers(prev => {
          const exists = prev.find(u => u.uid === user.uid);
          if (exists) {
            console.log('ℹ️ User already in list');
            return prev;
          }
          
          console.log('➕ Adding new user to list');
          
          // ✅ FIXED: Notify parent component INSIDE setRemoteUsers
          if (onUserJoined) {
            console.log('📢 Calling onUserJoined callback');
            onUserJoined(user.uid);
          }
          
          return [...prev, user];
        });
        
        // Play video after state update
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
        console.log('🔊 Playing audio');
      }
    } catch (error) {
      console.error("❌ Subscribe error:", error);
    }
  };

  const handleUserUnpublished = (user, mediaType) => {
    console.log(`👤 User ${user.uid} unpublished ${mediaType}`);
    if (mediaType === "video") {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    }
  };

  // ✅ FIXED: Proper callback placement
  const handleUserLeft = (user) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👋 User ${user.uid} left channel`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    
    // ✅ FIXED: Notify parent component INSIDE the function
    if (onUserLeft) {
      console.log('📢 Calling onUserLeft callback');
      onUserLeft(user.uid);
    }
  };

  const handleConnectionChange = (currentState, prevState) => {
    console.log(`🔌 Connection: ${prevState} -> ${currentState}`);
    if (currentState === "DISCONNECTED") {
      setError("Connection lost. Please rejoin the call.");
      setJoined(false);
    }
  };

  const joinCall = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🚀 JOINING AGORA CHANNEL`);
      console.log(`Channel: ${channelName}`);
      console.log(`User ID: ${userId}`);
      console.log(`User Name: ${userName}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      const { data } = await api.get(
        `/api/agora/token?channel=${channelName}&uid=${userId}`
      );

      if (!data.success) {
        throw new Error(data.message || 'Failed to get authentication token');
      }

      console.log('✅ Token received from server');
      console.log('App ID:', data.appId.substring(0, 8) + '...');

      await client.current.join(
        data.appId, 
        channelName, 
        data.token, 
        data.uid
      );

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
      
      console.log('✅ Tracks created successfully');
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      if (localContainer.current) {
        videoTrack.play(localContainer.current);
        console.log('✅ Local video playing');
      }

      await client.current.publish([audioTrack, videoTrack]);
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Published local tracks');
      console.log('🎉 JOIN COMPLETE - Waiting for others...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      setJoined(true);
      
    } catch (err) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ JOIN ERROR:', err);
      console.error('Error message:', err.message);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      let errorMessage = 'Failed to join call';
      
      if (err.message.includes('camera') || err.message.includes('microphone')) {
        errorMessage = 'Unable to access camera/microphone. Please check permissions.';
      } else if (err.code === 'INVALID_TOKEN') {
        errorMessage = 'Session expired. Please refresh and try again.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Video service temporarily unavailable.';
      } else if (err.message.includes('token')) {
        errorMessage = 'Authentication failed. Please refresh the page.';
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const leaveCall = async () => {
    if (!joined && !localAudioTrack && !localVideoTrack) {
      console.log('⚠️ Not in call, skipping leave');
      return;
    }

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

      if (client.current && joined) {
        await client.current.leave();
      }
      
      setJoined(false);
      setRemoteUsers([]);
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      setScreenTrack(null);
      setIsScreenSharing(false);
      setMicOn(true);
      setCamOn(true);
      setError(null);
      
      console.log('✅ Left call successfully');
      
      if (onLeave) {
        onLeave();
      }
      
    } catch (err) {
      console.error('❌ Leave call error:', err);
    }
  };

  const cleanup = async () => {
    await leaveCall();
    if (client.current) {
      client.current.removeAllListeners();
    }
  };

  const toggleMic = async () => {
    if (localAudioTrack) {
      const newState = !micOn;
      await localAudioTrack.setEnabled(newState);
      setMicOn(newState);
      console.log(`🎤 Microphone ${newState ? 'enabled' : 'disabled'}`);
    }
  };

  const toggleCamera = async () => {
    if (localVideoTrack) {
      const newState = !camOn;
      await localVideoTrack.setEnabled(newState);
      setCamOn(newState);
      console.log(`📹 Camera ${newState ? 'enabled' : 'disabled'}`);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        console.log('🖥️ Starting screen share...');
        
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
          console.log('🖥️ Screen share ended by user');
          toggleScreenShare();
        });
        
        console.log('✅ Screen sharing started');
        
      } else {
        console.log('🖥️ Stopping screen share...');
        
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
        console.log('✅ Screen sharing stopped');
      }
    } catch (error) {
      console.error('❌ Screen share error:', error);
      
      let errorMsg = 'Screen sharing failed. ';
      if (error.message.includes('Permission denied')) {
        errorMsg += 'Please allow screen sharing permission.';
      } else if (error.message.includes('NotAllowedError')) {
        errorMsg += 'Screen sharing was cancelled.';
      } else {
        errorMsg += 'Please try again.';
      }
      
      setError(errorMsg);
      setIsScreenSharing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${joined ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <h3 className="text-white font-semibold">
            {joined ? 'In Call' : 'Ready to Join'}
          </h3>
          <span className="text-gray-400 text-sm">
            Channel: {channelName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Users className="w-4 h-4" />
          <span className="text-sm">
            {remoteUsers.length + (joined ? 1 : 0)} participant{(remoteUsers.length + (joined ? 1 : 0)) !== 1 ? 's' : ''}
          </span>
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="ml-4 p-2 hover:bg-gray-700 rounded-lg transition"
              title={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className={`grid gap-4 h-full ${
          remoteUsers.length === 0 ? 'grid-cols-1' : 
          remoteUsers.length === 1 ? 'grid-cols-2' : 
          'grid-cols-2 lg:grid-cols-3'
        }`}>
          {/* Local Video */}
          {joined && (
            <div className="relative bg-black rounded-lg overflow-hidden shadow-lg">
              <div 
                ref={localContainer} 
                className="w-full h-full min-h-[300px]"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {!camOn && !isScreenSharing && (
                  <div className="bg-gray-800 rounded-full p-8">
                    <VideoIcon className="w-16 h-16 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="absolute bottom-3 left-3 bg-gradient-to-r from-gray-900/90 to-gray-800/90 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="font-medium">{userName} (You)</span>
                {!micOn && <MicOff className="w-3 h-3" />}
                {!camOn && <VideoOff className="w-3 h-3" />}
                {isScreenSharing && <Monitor className="w-3 h-3 text-blue-400" />}
              </div>
            </div>
          )}

          {/* Remote Videos */}
          {remoteUsers.map((user) => (
            <div key={user.uid} className="relative bg-black rounded-lg overflow-hidden shadow-lg">
              <div 
                ref={(el) => (remoteContainerRef.current[user.uid] = el)}
                className="w-full h-full min-h-[300px]"
              />
              <div className="absolute bottom-3 left-3 bg-gradient-to-r from-green-600/90 to-green-500/90 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span className="font-medium">Connected</span>
              </div>
              <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                🟢 Live
              </div>
            </div>
          ))}

          {/* Waiting/Join State */}
          {!joined && (
            <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg min-h-[300px]">
              <VideoIcon className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg font-medium mb-2">Ready to start class?</p>
              <p className="text-gray-500 text-sm">
                Click "Join Call" below to begin
              </p>
            </div>
          )}

          {/* Waiting for others */}
          {joined && remoteUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg min-h-[300px]">
              <Users className="w-16 h-16 text-gray-600 mb-4 animate-pulse" />
              <p className="text-gray-400 text-lg font-medium">Waiting for others to join...</p>
              <p className="text-gray-500 text-sm mt-2">
                Channel: <span className="font-mono bg-gray-700 px-2 py-1 rounded">{channelName}</span>
              </p>
              <div className="mt-4 text-gray-500 text-xs text-center max-w-md">
                <p>💡 Make sure the other participant is using the same class link</p>
                <p className="mt-1">They should see the same channel name above</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-2 bg-red-500/90 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="hover:bg-white/20 rounded p-1 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-800 p-6">
        <div className="flex items-center justify-center gap-4">
          {!joined ? (
            <button
              onClick={joinCall}
              disabled={loading}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <VideoIcon className="w-5 h-5" />
                  Join Call
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMic}
                title={micOn ? 'Mute' : 'Unmute'}
                className={`p-4 rounded-full transition-all shadow-lg hover:scale-110 ${
                  micOn 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                }`}
              >
                {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>

              <button
                onClick={toggleCamera}
                title={camOn ? 'Stop Video' : 'Start Video'}
                className={`p-4 rounded-full transition-all shadow-lg hover:scale-110 ${
                  camOn 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                }`}
              >
                {camOn ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>

              <button
                onClick={toggleScreenShare}
                title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                className={`p-4 rounded-full transition-all shadow-lg hover:scale-110 ${
                  isScreenSharing
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
              </button>

              <button
                onClick={leaveCall}
                title="Leave Call"
                className="p-4 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all shadow-lg hover:scale-110"
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
