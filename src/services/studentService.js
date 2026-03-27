import api from "../api"; // Use api instance instead of axios

const API_URL = "/api/students"; // Remove base URL, api already has it

// 👉 Get all students
export const getStudents = async () => {
  const res = await api.get(API_URL);
  return res.data;
};

// 👉 Create a student
export const createStudent = async (student) => {
  const res = await api.post(API_URL, student);
  return res.data;
};

// 👉 Update student
export const updateStudent = async (id, student) => {
  const res = await api.put(`${API_URL}/${id}`, student);
  return res.data.student;
};

// 👉 Schedule student for deletion (soft-delete — permanent after 7 days)
export const deleteStudent = async (id) => {
  const res = await api.delete(`${API_URL}/${id}`);
  return res.data;
};

// 👉 Restore a student that was scheduled for deletion
export const restoreStudent = async (id) => {
  const res = await api.post(`${API_URL}/${id}/restore`);
  return res.data;
};

// 👉 Toggle student active/inactive
export const toggleStudent = async (id, payload = {}) => {
  const res = await api.patch(`${API_URL}/${id}/toggle`, payload);
  return res.data.student;
};

// 👉 Reset password
export const apiResetPassword = async (id) => {
  const res = await api.post(`${API_URL}/${id}/reset-password`);
  return res.data;
};

// 👉 Record lesson
export const recordLesson = async (id, lessonData) => {
  const res = await api.post(`${API_URL}/${id}/lesson`, lessonData);
  return res.data;
};

// 👉 Add payment
export const addPayment = async (id, paymentData) => {
  const res = await api.post(`${API_URL}/${id}/payment`, paymentData);
  return res.data;
};

// 👉 Get payment history
export const getStudentPayments = async (id) => {
  const res = await api.get(`${API_URL}/${id}/payments`);
  return res.data;
};

// 👉 Get all payments (global)
export const getAllPayments = async () => {
  const res = await api.get("/api/payments");
  return res.data;
};

// 👉 Get all lessons (global)
export const getAllLessons = async () => {
  const res = await api.get("/api/lessons");
  return res.data;
};