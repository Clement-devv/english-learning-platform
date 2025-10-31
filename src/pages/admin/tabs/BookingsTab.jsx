// src/pages/admin/tabs/BookingsTab.jsx - UPDATED WITH REAL DATA
import React, { useState } from "react";
import { createBooking } from "../../../services/bookingService";

export default function BookingsTab({ teachers = [], students = [] }) {
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("60");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendBooking = async () => {
    if (!teacherId || !studentId || !classTitle || !scheduledTime) {
      setToast("Please fill in all required fields");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    try {
      setLoading(true);
      
      const bookingData = {
        teacherId,
        studentId,
        classTitle,
        topic,
        duration: parseInt(duration, 10),
        scheduledTime,
        notes,
        createdBy: "admin"
      };

      const newBooking = await createBooking(bookingData);

      const teacher = teachers.find((t) => t._id === teacherId);
      const student = students.find((s) => s._id === studentId);

      setToast(
        `Booking request sent to ${teacher.firstName} ${teacher.lastName} for student ${student.firstName} ${student.surname}`
      );
      setTimeout(() => setToast(""), 4000);

      // Clear form
      setTeacherId("");
      setStudentId("");
      setTopic("");
      setClassTitle("");
      setDuration("60");
      setScheduledTime("");
      setNotes("");
    } catch (err) {
      console.error("Error creating booking:", err);
      setToast(err.response?.data?.message || "Failed to create booking");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {toast && (
        <div className={`mb-4 px-4 py-2 rounded shadow text-white ${
          toast.includes("Failed") ? "bg-red-600" : "bg-green-600"
        }`}>
          {toast}
        </div>
      )}

      <h2 className="text-2xl font-bold mb-6 text-brand-primary">
        Send Booking Request
      </h2>

      <div className="grid gap-4 max-w-lg">
        {/* Teacher dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Teacher <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Choose a teacher --</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.firstName} {t.lastName} ({t.email})
              </option>
            ))}
          </select>
        </div>

        {/* Student dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Student <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Choose a student --</option>
            {students.map((s) => (
              <option key={s._id} value={s._id}>
                {s.firstName} {s.surname} ({s.email})
              </option>
            ))}
          </select>
        </div>

        {/* Class Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Grammar Fundamentals"
            className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={classTitle}
            onChange={(e) => setClassTitle(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic
          </label>
          <input
            type="text"
            placeholder="e.g., Present Perfect Tense"
            className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (minutes)
          </label>
          <input
            type="number"
            placeholder="60"
            className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={loading}
            min="15"
            max="180"
          />
        </div>

        {/* Scheduled Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scheduled Date & Time <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            placeholder="Any additional information for the teacher..."
            className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            rows="3"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSendBooking}
          disabled={loading}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-brand-primary text-white hover:bg-brand-secondary"
          }`}
        >
          {loading ? "Sending..." : "Send Booking Request"}
        </button>
      </div>

      {/* Helper Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• The teacher will receive a booking request</li>
          <li>• They can accept or reject the booking</li>
          <li>• Once accepted, the class will appear in both dashboards</li>
          <li>• The student will be able to see their scheduled classes</li>
        </ul>
      </div>
    </div>
  );
}
