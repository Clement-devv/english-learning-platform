// src/components/bookings/RecurringBookingForm.jsx - RECURRING BOOKINGS FORM
import React, { useState } from "react";
import { Repeat, Calendar, Clock, AlertCircle } from "lucide-react";
import api from "../../api";

/**
 * RecurringBookingForm Component
 * 
 * Allows admin to create recurring class bookings with various patterns
 * 
 * Props:
 * @param {Array} teachers - List of available teachers
 * @param {Array} students - List of available students
 * @param {Function} onSuccess - Callback when recurring bookings created successfully
 * @param {Function} onCancel - Callback when form is cancelled
 */
export default function RecurringBookingForm({ 
  teachers = [], 
  students = [], 
  onSuccess, 
  onCancel 
}) {
  // Form state
  const [formData, setFormData] = useState({
    teacherId: "",
    studentId: "",
    classTitle: "",
    topic: "",
    startTime: "",
    duration: "60",
    notes: "",
    frequency: "weekly",
    occurrences: "10",
    daysOfWeek: []
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Handle input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  /**
   * Handle day of week selection (for weekly frequency)
   */
  const toggleDayOfWeek = (day) => {
    setFormData(prev => {
      const currentDays = prev.daysOfWeek;
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      
      return {
        ...prev,
        daysOfWeek: newDays
      };
    });
  };

  /**
   * Generate preview dates
   */
  const generatePreview = () => {
    const startDate = new Date(formData.startTime);
    if (!formData.startTime || isNaN(startDate.getTime())) {
      return;
    }

    const dates = [];
    const occurrences = parseInt(formData.occurrences);

    if (formData.frequency === 'weekly' && formData.daysOfWeek.length > 0) {
      // Generate for specific days of week
      let weeksGenerated = 0;
      while (dates.length < occurrences) {
        for (let day of formData.daysOfWeek) {
          if (dates.length >= occurrences) break;
          
          const date = new Date(startDate);
          const currentDay = date.getDay();
          const daysUntilTarget = (day - currentDay + 7) % 7;
          date.setDate(date.getDate() + daysUntilTarget + (weeksGenerated * 7));
          
          if (date >= startDate) {
            dates.push(new Date(date));
          }
        }
        weeksGenerated++;
      }
    } else {
      // Generate based on frequency
      let currentDate = new Date(startDate);
      
      for (let i = 0; i < occurrences; i++) {
        dates.push(new Date(currentDate));
        
        switch (formData.frequency) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'biweekly':
            currentDate.setDate(currentDate.getDate() + 14);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }
      }
    }

    setPreview(dates.sort((a, b) => a - b));
    setShowPreview(true);
  };

  /**
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.teacherId) newErrors.teacherId = "Please select a teacher";
    if (!formData.studentId) newErrors.studentId = "Please select a student";
    if (!formData.classTitle.trim()) newErrors.classTitle = "Class title is required";
    if (!formData.startTime) newErrors.startTime = "Start date and time is required";
    if (!formData.frequency) newErrors.frequency = "Please select frequency";
    
    const occurrences = parseInt(formData.occurrences);
    if (isNaN(occurrences) || occurrences < 2 || occurrences > 100) {
      newErrors.occurrences = "Occurrences must be between 2 and 100";
    }

    if (formData.frequency === 'weekly' && formData.daysOfWeek.length === 0) {
      newErrors.daysOfWeek = "Please select at least one day for weekly bookings";
    }

    // Check student has enough classes
    const student = students.find(s => s._id === formData.studentId);
    if (student && student.noOfClasses < occurrences) {
      newErrors.studentId = `Student only has ${student.noOfClasses} classes remaining`;
    }

    // Check start time is in future
    const startDate = new Date(formData.startTime);
    if (startDate <= new Date()) {
      newErrors.startTime = "Start time must be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Submit form
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        duration: parseInt(formData.duration),
        occurrences: parseInt(formData.occurrences),
        daysOfWeek: formData.frequency === 'weekly' ? formData.daysOfWeek : []
      };

      const response = await api.post("/api/recurring-bookings", payload);

      if (response.data.success) {
        if (onSuccess) {
          onSuccess(response.data.recurringPattern);
        }
      }

    } catch (error) {
      console.error("Error creating recurring bookings:", error);
      setErrors({
        submit: error.response?.data?.message || "Failed to create recurring bookings"
      });
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Repeat className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-800">Create Recurring Bookings</h2>
      </div>

      {/* Error Alert */}
      {errors.submit && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Error</p>
            <p className="text-red-600 text-sm">{errors.submit}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Teacher & Student */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Teacher <span className="text-red-500">*</span>
            </label>
            <select
              name="teacherId"
              value={formData.teacherId}
              onChange={handleChange}
              className={`w-full border rounded-lg p-3 ${
                errors.teacherId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">-- Select Teacher --</option>
              {teachers.map(t => (
                <option key={t._id} value={t._id}>
                  {t.firstName} {t.lastName} - {t.continent}
                </option>
              ))}
            </select>
            {errors.teacherId && (
              <p className="text-red-500 text-sm mt-1">{errors.teacherId}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Student <span className="text-red-500">*</span>
            </label>
            <select
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              className={`w-full border rounded-lg p-3 ${
                errors.studentId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">-- Select Student --</option>
              {students.map(s => (
                <option key={s._id} value={s._id}>
                  {s.firstName} {s.surname} - {s.noOfClasses} classes
                </option>
              ))}
            </select>
            {errors.studentId && (
              <p className="text-red-500 text-sm mt-1">{errors.studentId}</p>
            )}
          </div>
        </div>

        {/* Class Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Class Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="classTitle"
              value={formData.classTitle}
              onChange={handleChange}
              className={`w-full border rounded-lg p-3 ${
                errors.classTitle ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g., Weekly English Conversation"
            />
            {errors.classTitle && (
              <p className="text-red-500 text-sm mt-1">{errors.classTitle}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Topic <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              name="topic"
              value={formData.topic}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3"
              placeholder="e.g., Business English"
            />
          </div>
        </div>

        {/* Time & Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              First Class Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              className={`w-full border rounded-lg p-3 ${
                errors.startTime ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.startTime && (
              <p className="text-red-500 text-sm mt-1">{errors.startTime}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3"
              min="15"
              max="180"
            />
          </div>
        </div>

        {/* Recurring Pattern */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Recurring Pattern
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Frequency <span className="text-red-500">*</span>
              </label>
              <select
                name="frequency"
                value={formData.frequency}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Number of Classes <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="occurrences"
                value={formData.occurrences}
                onChange={handleChange}
                className={`w-full border rounded-lg p-3 ${
                  errors.occurrences ? "border-red-500" : "border-gray-300"
                }`}
                min="2"
                max="100"
              />
              {errors.occurrences && (
                <p className="text-red-500 text-sm mt-1">{errors.occurrences}</p>
              )}
            </div>
          </div>

          {/* Days of Week (for weekly) */}
          {formData.frequency === 'weekly' && (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Days of Week <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {dayNames.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDayOfWeek(index)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      formData.daysOfWeek.includes(index)
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {errors.daysOfWeek && (
                <p className="text-red-500 text-sm mt-1">{errors.daysOfWeek}</p>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg p-3"
            rows="3"
            placeholder="Any special instructions or notes..."
          />
        </div>

        {/* Preview Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={generatePreview}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Preview Dates
          </button>
        </div>

        {/* Preview */}
        {showPreview && preview.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-3">
              Preview: {preview.length} classes will be created
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {preview.map((date, index) => (
                <div
                  key={index}
                  className="bg-white p-2 rounded border border-blue-100 text-sm"
                >
                  <div className="font-medium text-gray-800">
                    {date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-gray-600 text-xs">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg"
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </span>
            ) : (
              `Create ${formData.occurrences || 0} Recurring Classes`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
