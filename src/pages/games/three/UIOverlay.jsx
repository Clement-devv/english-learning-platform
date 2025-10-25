import React from "react";

export default function UIOverlay({ score }) {
  return (
    <div className="absolute top-0 left-0 w-full flex justify-between items-center p-4 text-lg font-bold text-white">
      <div className="bg-black/40 rounded-xl px-4 py-2">
        🏁 <span className="text-yellow-300">Word Racer</span>
      </div>
      <div className="bg-black/40 rounded-xl px-4 py-2">
        Score: <span className="text-green-300">{score}</span>
      </div>
    </div>
  );
}
