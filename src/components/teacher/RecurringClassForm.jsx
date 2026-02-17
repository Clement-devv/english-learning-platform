// src/components/teacher/RecurringClassForm.jsx -
import React, { useState } from "react";
import { Repeat, Calendar, Clock, AlertCircle, X } from "lucide-react";
import api from "../../api";

/**
 * RecurringClassForm Component for Teachers
 * 
 * Allows teachers to create recurring classes with their assigned students
 * 
 * Props:
 * @param {Array} students - List of assigned students
 * @param {Function} onSuccess - Callback when recurring classes created successfully
 * @param {Function} onCancel - Callback when form is cancelled
 * @param {Object} teacherInfo - Teacher information
 */
export default function RecurringClassForm({ 
  students = [], 
  onSuccess, 
  onCancel,
  teacherInfo
}) {
  // Form state
  const [formData, setFormData] = useState({
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
      setErrors({ submit: "Please enter a valid start date and time" });
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
    setErrors({});
  };

  /**
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.studentId) newErrors.studentId = "Please select a student";
    if (!formData.classTitle.trim()) newErrors.classTitle = "Class title is required";
    if (!formData.startTime) newErrors.startTime = "Start date and time is required";
    if (!formData.frequency) newErrors.frequency = "Please select frequency";
    
    const occurrences = parseInt(formData.occurrences);
    if (isNaN(occurrences) || occurrences < 2 || occurrences > 100) {
      newErrors.occurrences = "Occurrences must be between 2 and 100";
    }

    if (formData.frequency === 'weekly' && formData.daysOfWeek.length === 0) {
      newErrors.daysOfWeek = "Please select at least one day for weekly classes";
    }

    // Check student has enough classes
    const student = students.find(s => s.id === formData.studentId);
    if (student && student.progress < occurrences) {
      newErrors.studentId = `Student only has ${student.progress} classes remaining`;
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
        teacherId: teacherInfo._id || teacherInfo.id,
        studentId: formData.studentId,
        classTitle: formData.classTitle,
        topic: formData.topic,
        startTime: formData.startTime,
        duration: parseInt(formData.duration),
        notes: formData.notes,
        frequency: formData.frequency,
        occurrences: parseInt(formData.occurrences),
        daysOfWeek: formData.frequency === 'weekly' ? formData.daysOfWeek : []
      };

      console.log("📤 Creating recurring classes:", payload);

      const response = await api.post("/api/recurring-bookings", payload);

      if (response.data.success) {
        console.log("✅ Recurring classes created:", response.data.recurringPattern);
        
        if (onSuccess) {
          onSuccess(response.data.recurringPattern);
        }
      }

    } catch (error) {
      console.error("Error creating recurring classes:", error);
      
      let errorMessage = "Failed to create recurring classes";
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({
        submit: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Repeat className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Create Recurring Classes</h2>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
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
        {/* Student Selection */}
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
              <option key={s.id} value={s.id}>
                {s.name} - {s.progress} classes remaining
              </option>
            ))}
          </select>
          {errors.studentId && (
            <p className="text-red-500 text-sm mt-1">{errors.studentId}</p>
          )}
        </div>

        {/* Class Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Class Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="classTitle"
              value={formData.classTitle}
              onChange={handleChange}
              placeholder="e.g., Advanced Grammar Series"
              className={`w-full border rounded-lg p-3 ${
                errors.classTitle ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.classTitle && (
              <p className="text-red-500 text-sm mt-1">{errors.classTitle}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Topic (Optional)
            </label>
            <input
              type="text"
              name="topic"
              value={formData.topic}
              onChange={handleChange}
              placeholder="e.g., Present Perfect Tense"
              className="w-full border border-gray-300 rounded-lg p-3"
            />
          </div>
        </div>

        {/* Schedule */}
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
              min={new Date().toISOString().slice(0, 16)}
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
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

          {/* Days of Week (for weekly frequency) */}
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
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      formData.daysOfWeek.includes(index)
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {errors.daysOfWeek && (
                <p className="text-red-500 text-sm mt-2">{errors.daysOfWeek}</p>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="Add any special instructions or notes for these classes..."
            className="w-full border border-gray-300 rounded-lg p-3 resize-none"
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
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
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
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg"
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

      {/* Info Card */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>ℹ️ Note:</strong> All recurring classes you create will be automatically accepted 
          and added to your schedule. Students will be notified about the new classes.
        </p>
      </div>
    </div>
  );
}
