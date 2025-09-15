import React, { useState } from "react";

export default function ClassForm({ onAdd, students }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]);

  const handleCheckboxChange = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id)
        ? prev.filter((sid) => sid !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !time || !topic) return;

    const chosenStudents = students.filter((s) =>
      selectedStudents.includes(s.id)
    );

    onAdd({
      id: Date.now(),
      title,
      time,
      topic,
      participants: chosenStudents.length,
      students: chosenStudents,
      status: "scheduled",
    });

    // Reset form
    setTitle("");
    setTime("");
    setTopic("");
    setSelectedStudents([]);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded-xl shadow flex flex-col gap-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Class Title"
        className="px-3 py-2 border rounded"
      />
      <input
        value={time}
        onChange={(e) => setTime(e.target.value)}
        placeholder="Time (e.g., 2 PM)"
        className="px-3 py-2 border rounded"
      />
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic"
        className="px-3 py-2 border rounded"
      />

      {/* Student checkboxes */}
      <div>
        <p className="font-medium text-gray-700 mb-2">Assign Students:</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {students.map((s) => (
            <label
              key={s.id}
              className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedStudents.includes(s.id)}
                onChange={() => handleCheckboxChange(s.id)}
              />
              <span className="text-sm text-gray-800">
                {s.name} <span className="text-gray-500">({s.level})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Add Class
      </button>
    </form>
  );
}
