// src/pages/admin/tabs/BookingsTab.jsx 
import React, { useState } from "react";
import { createBooking } from "../../../services/bookingService";
import { Repeat, Plus, X } from "lucide-react";
import RecurringBookingForm from "../../../components/bookings/RecurringBookingForm";
import api from "../../../api";

/**
 * BookingsTab Component - Admin Only
 * 
 * Purpose: Allow admins to create booking requests for teachers
 * 
 * Workflow:
 * 1. Admin fills form (teacher, student, class details)
 * 2. Creates booking with status "pending"
 * 3. Teacher receives booking request in their "Bookings" tab
 * 4. Teacher accepts/rejects → If accepted, becomes a class
 */
export default function BookingsTab({ teachers = [], students = [], onNotify }) { // ✅ FIXED: Added onNotify
  // Form state
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("60");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  
  // UI state
  const [toast, setToast] = useState({ message: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [showRecurringForm, setShowRecurringForm] = useState(false);

  /**
   * Validate form data
   */
  const validateForm = () => {
    const newErrors = {};

    if (!teacherId) newErrors.teacher = "Please select a teacher";
    if (!studentId) newErrors.student = "Please select a student";
    if (!classTitle.trim()) newErrors.classTitle = "Class title is required";
    if (!scheduledTime) newErrors.scheduledTime = "Please select date and time";
    
    // Validate future date
    const selectedDate = new Date(scheduledTime);
    const now = new Date();
    if (selectedDate <= now) {
      newErrors.scheduledTime = "Scheduled time must be in the future";
    }

    // Validate duration
    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum < 15 || durationNum > 180) {
      newErrors.duration = "Duration must be between 15 and 180 minutes";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Show toast notification
   */
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  /**
   * Handle form submission
   */
  const handleSendBooking = async () => {
    // Validate form
    if (!validateForm()) {
      showToast("Please fix the errors in the form", "error");
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      
      // Find teacher and student for display
      const teacher = teachers.find((t) => t._id === teacherId);
      const student = students.find((s) => s._id === studentId);

      // Check if student has classes remaining
      if (student.noOfClasses <= 0) {
        showToast(
          `${student.firstName} ${student.surname} has no classes remaining. Please add classes first.`,
          "error"
        );
        setLoading(false);
        return;
      }

      // Prepare booking data
      const bookingData = {
        teacherId,
        studentId,
        classTitle: classTitle.trim(),
        topic: topic.trim(),
        duration: parseInt(duration, 10),
        scheduledTime,
        notes: notes.trim(),
        createdBy: "admin" // ✅ IMPORTANT: This marks it as admin-created
      };

      console.log("📤 Creating booking request:", bookingData);

      // Create booking
      const newBooking = await createBooking(bookingData);

      console.log("✅ Booking request created:", newBooking);

      // Success message
      showToast(
        `Booking request sent to ${teacher.firstName} ${teacher.lastName} for student ${student.firstName} ${student.surname}`,
        "success"
      );

      // Clear form
      clearForm();

    } catch (err) {
      console.error("❌ Error creating booking:", err);
      
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          "Failed to create booking";
      
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear form data
   */
  const clearForm = () => {
    setTeacherId("");
    setStudentId("");
    setClassTitle("");
    setTopic("");
    setDuration("60");
    setScheduledTime("");
    setNotes("");
    setErrors({});
  };

  /**
   * Get minimum datetime for input (now + 1 hour)
   */
  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  /**
   * Get student display with class count
   */
  const getStudentDisplay = (student) => {
    const classText = student.noOfClasses === 1 ? "class" : "classes";
    return `${student.firstName} ${student.surname} - ${student.noOfClasses} ${classText} remaining`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toast.message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-green-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {toast.type === "error" ? "❌" : "✅"}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ✅ FIXED: Header with button on the right */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-brand-primary mb-2">
              Send Booking Request
            </h2>
            <p className="text-gray-600">
              Create a class booking request for a teacher to accept
            </p>
          </div>
          
          {/* Recurring Bookings Button */}
          <button
            onClick={() => setShowRecurringForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg"
          >
            <Repeat className="w-5 h-5" />
            Create Recurring Classes
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-5">
        {/* Teacher Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Teacher <span className="text-red-500">*</span>
          </label>
          <select
            className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all ${
              errors.teacher ? "border-red-500" : "border-gray-300"
            }`}
            value={teacherId}
            onChange={(e) => {
              setTeacherId(e.target.value);
              setErrors({ ...errors, teacher: "" });
            }}
            disabled={loading}
          >
            <option value="">-- Choose a teacher --</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.firstName} {t.lastName} ({t.email}) - {t.continent}
              </option>
            ))}
          </select>
          {errors.teacher && (
            <p className="text-red-500 text-sm mt-1">{errors.teacher}</p>
          )}
        </div>

        {/* Student Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Student <span className="text-red-500">*</span>
          </label>
          <select
            className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all ${
              errors.student ? "border-red-500" : "border-gray-300"
            }`}
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setErrors({ ...errors, student: "" });
            }}
            disabled={loading}
          >
            <option value="">-- Choose a student --</option>
            {students.map((s) => (
              <option 
                key={s._id} 
                value={s._id}
                disabled={s.noOfClasses <= 0}
                className={s.noOfClasses <= 0 ? "text-gray-400" : ""}
              >
                {getStudentDisplay(s)}
              </option>
            ))}
          </select>
          {errors.student && (
            <p className="text-red-500 text-sm mt-1">{errors.student}</p>
          )}
          {studentId && students.find(s => s._id === studentId)?.noOfClasses <= 0 && (
            <p className="text-orange-600 text-sm mt-1">
              ⚠️ This student has no classes remaining. Please add classes first.
            </p>
          )}
        </div>

        {/* Class Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Class Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Grammar Fundamentals"
            className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all ${
              errors.classTitle ? "border-red-500" : "border-gray-300"
            }`}
            value={classTitle}
            onChange={(e) => {
              setClassTitle(e.target.value);
              setErrors({ ...errors, classTitle: "" });
            }}
            disabled={loading}
            maxLength={100}
          />
          {errors.classTitle && (
            <p className="text-red-500 text-sm mt-1">{errors.classTitle}</p>
          )}
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Topic <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Present Perfect Tense"
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            maxLength={100}
          />
        </div>

        {/* Duration and Scheduled Time Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="60"
              className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all ${
                errors.duration ? "border-red-500" : "border-gray-300"
              }`}
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                setErrors({ ...errors, duration: "" });
              }}
              disabled={loading}
              min="15"
              max="180"
            />
            {errors.duration && (
              <p className="text-red-500 text-sm mt-1">{errors.duration}</p>
            )}
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Scheduled Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all ${
                errors.scheduledTime ? "border-red-500" : "border-gray-300"
              }`}
              value={scheduledTime}
              onChange={(e) => {
                setScheduledTime(e.target.value);
                setErrors({ ...errors, scheduledTime: "" });
              }}
              disabled={loading}
              min={getMinDateTime()}
            />
            {errors.scheduledTime && (
              <p className="text-red-500 text-sm mt-1">{errors.scheduledTime}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            placeholder="Any additional information for the teacher..."
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            rows="4"
            maxLength={500}
          />
          <div className="text-right text-sm text-gray-400 mt-1">
            {notes.length}/500 characters
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSendBooking}
            disabled={loading}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-brand-primary text-white hover:bg-brand-secondary hover:shadow-lg"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Sending...</span>
              </span>
            ) : (
              "Send Booking Request"
            )}
          </button>

          <button
            onClick={clearForm}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
          >
            Clear Form
          </button>
        </div>
      </div>

      {/* Recurring Booking Modal */}
      {showRecurringForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Create Recurring Classes</h2>
              <button
                onClick={() => setShowRecurringForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <RecurringBookingForm 
                teachers={teachers}
                students={students}
                onSuccess={(pattern) => {
                  console.log("✅ Recurring classes created:", pattern);
                  setShowRecurringForm(false);
                  // ✅ FIXED: Check if onNotify exists before calling
                  if (onNotify) {
                    onNotify(`Created ${pattern.occurrences} recurring classes!`);
                  }
                }}
                onCancel={() => setShowRecurringForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Information Card */}
      <div className="mt-6 p-5 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How it works
        </h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>You create a booking request by selecting a teacher, student, and class details</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>The teacher receives the request in their "Bookings" tab</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>The teacher can accept or reject the request</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>Once accepted, the class appears in both teacher and student dashboards</span>
          </li>
        </ul>
      </div>
    </div>
  );
}