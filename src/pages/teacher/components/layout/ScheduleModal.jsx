import React, { useState } from "react";

export default function ScheduleModal({ isOpen, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [topic, setTopic] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Schedule New Class</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Class Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="text"
            placeholder="Date & Time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="text"
            placeholder="Topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="number"
            placeholder="Max Students"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div className="flex justify-end mt-5 gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({
                id: Date.now(),
                title,
                time,
                topic,
                maxParticipants: parseInt(maxParticipants) || 1,
                participants: 0,
                status: "scheduled",
                students: [],
              });
              setTitle("");
              setTime("");
              setTopic("");
              setMaxParticipants("");
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
