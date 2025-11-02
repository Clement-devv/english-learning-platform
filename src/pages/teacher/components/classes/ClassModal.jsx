// src/pages/teacher/components/classes/ClassModal.jsx 
import React, { useState } from "react";
import { X, Users, Calendar, Clock, BookOpen, Plus } from "lucide-react";

export default function ClassModal({ isOpen, onClose, onSave, students }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [selectedStudents, setSelectedStudents] = useState([]);

  if (!isOpen) return null;

  const handleStudentToggle = (student) => {
    setSelectedStudents((prev) => {
      const isSelected = prev.some((s) => s.id === student.id);
      if (isSelected) {
        return prev.filter((s) => s.id !== student.id);
      } else {
        return [...prev, student];
      }
    });
  };

  const handleSubmit = () => {
    if (!title || !topic || !time || selectedStudents.length === 0) {
      alert("Please fill in all fields and select at least one student");
      return;
    }

    onSave({
      id: Date.now(),
      title,
      topic,
      time,
      duration: parseInt(duration, 10),
      students: selectedStudents,
      status: "scheduled",
    });

    // Reset form
    setTitle("");
    setTopic("");
    setTime("");
    setDuration("60");
    setSelectedStudents([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plus className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Create New Class</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Class Title */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Class Title *
            </label>
            <input
              type="text"
              placeholder="e.g., Advanced Grammar Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            />
          </div>

          {/* Topic */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <BookOpen className="w-4 h-4 text-green-600" />
              Topic/Description *
            </label>
            <input
              type="text"
              placeholder="e.g., Past Perfect Tense & Conditionals"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Clock className="w-4 h-4 text-orange-600" />
                Duration (minutes) *
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all outline-none"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </div>
          </div>

          {/* ✅ IMPROVED: Multi-student selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Users className="w-4 h-4 text-indigo-600" />
              Select Students * ({selectedStudents.length} selected)
            </label>
            
            {students && students.length > 0 ? (
              <div className="border-2 border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                {students.map((student) => {
                  const isSelected = selectedStudents.some((s) => s.id === student.id);
                  return (
                    <label
                      key={student.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-50 border-2 border-indigo-500"
                          : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleStudentToggle(student)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No students assigned yet</p>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> You can select multiple students for a group class. 
              All selected students will be scheduled for the same class time.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl flex justify-end gap-3 border-t">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Class
          </button>
        </div>
      </div>
    </div>
  );
}
