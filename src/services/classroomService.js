// src/services/classroomService.js - CLASSROOM MANAGEMENT SERVICE
import api from "../api";

/**
 * Update classroom attendance (join, leave, heartbeat)
 */
export const updateClassroomAttendance = async (attendanceData) => {
  const res = await api.post("/api/classroom/attendance", attendanceData);
  return res.data;
};

/**
 * End class early with complaint
 * Creates a complaint record for admin review
 */
export const endClassEarly = async (complaintData) => {
  const res = await api.post("/api/classroom/end-early", complaintData);
  return res.data;
};

/**
 * Check if class meets completion requirements
 */
export const checkClassCompletion = async (bookingId) => {
  const res = await api.get(`/api/classroom/check-completion/${bookingId}`);
  return res.data;
};

/**
 * Get classroom session data (for debugging/admin)
 */
export const getClassroomSession = async (bookingId) => {
  const res = await api.get(`/api/classroom/session/${bookingId}`);
  return res.data;
};