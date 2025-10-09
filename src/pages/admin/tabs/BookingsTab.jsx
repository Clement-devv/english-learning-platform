import React, { useState } from "react";

export default function BookingsTab({ teachers = [], students = [] }) {
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [topic, setTopic] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState("");

  const handleSendBooking = () => {
    if (
      !teacherId ||
      !studentId ||
      !topic ||
      !time ||
      !classTitle ||
      !duration
    ) {
      setToast("Please fill in all fields");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    // Simulate sending booking
    console.log("Booking sent:", {
      teacherId,
      studentId,
      topic,
      classTitle,
      duration,
      time,
      notes,
    });

    setToast("Booking request sent!");
    setTimeout(() => setToast(""), 3000);

    // Clear form
    setTeacherId("");
    setStudentId("");
    setTopic("");
    setClassTitle("");
    setDuration("");
    setTime("");
    setNotes("");
  };

  return (
    <div className="p-6">
      {toast && (
        <div className="mb-4 px-4 py-2 bg-green-600 text-white rounded shadow">
          {toast}
        </div>
      )}

      <h2 className="text-2xl font-bold mb-6 text-brand-primary">
        Send Booking Request
      </h2>

      <div className="grid gap-4 max-w-lg">
        {/* Teacher dropdown */}
        <select
          className="border rounded p-2"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">Select Teacher</option>
          {teachers.map((t, idx) => (
            <option key={idx} value={t.email}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>

        {/* Student dropdown */}
        <select
          className="border rounded p-2"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">Select Student</option>
          {students.map((s, idx) => (
            <option key={idx} value={s.email}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Class Title"
          className="border rounded p-2"
          value={classTitle}
          onChange={(e) => setClassTitle(e.target.value)}
        />

        <input
          type="number"
          placeholder="Duration (minutes)"
          className="border rounded p-2"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />

        <input
          type="text"
          placeholder="Topic"
          className="border rounded p-2"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <input
          type="datetime-local"
          className="border rounded p-2"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />

        <textarea
          placeholder="Notes (optional)"
          className="border rounded p-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button
          onClick={handleSendBooking}
          className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-secondary"
        >
          Send Request
        </button>
      </div>
    </div>
  );
}
