// src/services/teacherStudentService.js
import api from "../api";

/**
 * Get all students assigned to a specific teacher
 * @param {string} teacherId - The teacher's ID
 */
export const getAssignedStudents = async (teacherId) => {
  const res = await api.get(`/api/teachers/${teacherId}/students`);
  return res.data.data; // Returns array of { assignmentId, assignedDate, student }
};

/**
 * Get all assignments for a specific teacher with full details
 * @param {string} teacherId - The teacher's ID
 */
export const getTeacherAssignments = async (teacherId) => {
  const res = await api.get(`/api/teachers/${teacherId}/assignments`);
  return res.data.data;
};