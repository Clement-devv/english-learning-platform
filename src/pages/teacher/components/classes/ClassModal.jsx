import React, { useState } from "react";

export default function ClassModal({ isOpen, onClose, onSave, students }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(""); 
  const [selectedStudents, setSelectedStudents] = useState([]);

  if (!isOpen) return null;

  const toggleStudent = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!title || !topic || !time) return;

    // Map selected IDs to full student objects
    const assignedStudents = students.filter((st) =>
      selectedStudents.includes(st.id)
    );

    onSave({
      id: Date.now(),
      title,
      topic,
      time, // stored as ISO string from datetime-local
      duration: Number(duration),
      students: assignedStudents, // ✅ full student objects
      status: "scheduled",
    });

    setTitle("");
    setTopic("");
    setTime("");
    setDuration("");
    setSelectedStudents([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create New Class</h3>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Class Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />

          {/* Duration */}
          <input
            type="number"
            min="15"
            step="15"
            placeholder="Duration (minutes)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />

          <div>
            <label className="block text-sm font-medium mb-1">
              Assign Students
            </label>
            <div className="max-h-40 overflow-y-auto border rounded p-2">
              {students.map((st) => (
                <label key={st.id} className="flex items-center space-x-2 mb-1">
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(st.id)}
                    onChange={() => toggleStudent(st.id)}
                  />
                  <span className="text-sm text-gray-700">{st.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
