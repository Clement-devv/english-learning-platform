// src/services/bookingService.js - 
import api from "../api";

/**
 * Get all bookings for a specific teacher
 * @param {string} teacherId - The teacher's ID
 * @param {string} status - Optional status filter (pending, accepted, rejected, completed, cancelled)
 */
export const getTeacherBookings = async (teacherId, status = null) => {
  const url = status 
    ? `/bookings/teacher/${teacherId}?status=${status}`
    : `/bookings/teacher/${teacherId}`;
  
  const res = await api.get(url);
  return res.data;
};

/**
 * Get all bookings for a specific student
 * @param {string} studentId - The student's ID
 * @param {string} status - Optional status filter
 */
export const getStudentBookings = async (studentId, status = null) => {
  const url = status 
    ? `/bookings/student/${studentId}?status=${status}`
    : `/bookings/student/${studentId}`;
  
  const res = await api.get(url);
  return res.data;
};

/**
 * Get all bookings (Admin only)
 */
export const getAllBookings = async () => {
  const res = await api.get("/bookings");
  return res.data;
};

/**
 * Create a new booking
 */
export const createBooking = async (bookingData) => {
  const res = await api.post("/bookings", bookingData);
  return res.data.booking;
};

/**
 * Teacher accepts a booking
 */
export const acceptBooking = async (bookingId) => {
  const res = await api.patch(`/bookings/${bookingId}/accept`);
  return res.data.booking;
};

/**
 * Teacher rejects a booking
 */
export const rejectBooking = async (bookingId, reason = "") => {
  const res = await api.patch(`/bookings/${bookingId}/reject`, { reason });
  return res.data.booking;
};

/**
 * Mark booking as completed (ENHANCED)
 * This will:
 * 1. Mark booking as completed
 * 2. Reduce student's classCredits by 1
 * 3. Return updated booking and student info
 */
export const completeBooking = async (bookingId) => {
  const res = await api.patch(`/bookings/${bookingId}/complete`);
  return res.data;
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (bookingId, reason = "") => {
  const res = await api.patch(`/bookings/${bookingId}/cancel`, { reason });
  return res.data.booking;
};

/**
 * Delete a booking (Admin only)
 */
export const deleteBooking = async (bookingId) => {
  const res = await api.delete(`/bookings/${bookingId}`);
  return res.data;
};

/**
 * Auto-complete expired bookings (for background/cron jobs)
 */
export const autoCompleteExpiredBookings = async () => {
  const res = await api.post("/bookings/auto-complete");
  return res.data;
};