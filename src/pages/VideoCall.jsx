// VideoCall.jsx
import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import axios from "axios";

const APP_ID = "YOUR_AGORA_APP_ID";

export default function VideoCall({ channelName, userId }) {
  const client = useRef(null);
  const [joined, setJoined] = useState(false);
  const localContainer = useRef();
  const remoteContainer = useRef();

  const joinCall = async () => {
    client.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    const { data } = await axios.get(`/api/agora/token?channel=${channelName}&uid=${userId}`);
    const token = data.token;

    await client.current.join(APP_ID, channelName, token, userId);
    const localTrack = await AgoraRTC.createMicrophoneAndCameraTracks();
    localTrack[1].play(localContainer.current);
    await client.current.publish(localTrack);
    setJoined(true);

    client.current.on("user-published", async (user, mediaType) => {
      await client.current.subscribe(user, mediaType);
      if (mediaType === "video") user.videoTrack.play(remoteContainer.current);
    });
  };

  const leaveCall = async () => {
    await client.current.leave();
    setJoined(false);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-4 my-4">
        <button onClick={joinCall} disabled={joined} className="px-4 py-2 bg-green-500 text-white rounded">
          Join Call
        </button>
        <button onClick={leaveCall} disabled={!joined} className="px-4 py-2 bg-red-500 text-white rounded">
          Leave Call
        </button>
      </div>
      <div className="flex gap-4">
        <div ref={localContainer} className="w-64 h-48 bg-gray-200 rounded" />
        <div ref={remoteContainer} className="w-64 h-48 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
