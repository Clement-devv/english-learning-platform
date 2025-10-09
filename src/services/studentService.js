import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/students`;

// 👉 Get all students
export const getStudents = async () => {
  const res = await axios.get(API_URL);
  return res.data; // [students]
};

// 👉 Create a student
export const createStudent = async (student) => {
  const res = await axios.post(API_URL, student);
  return res.data; // ✅ Return the full response (includes student AND tempPassword)
};

// 👉 Update student
export const updateStudent = async (id, student) => {
  const res = await axios.put(`${API_URL}/${id}`, student);
  return res.data.student; // extract student
};

// 👉 Delete student
export const deleteStudent = async (id) => {
  const res = await axios.delete(`${API_URL}/${id}`);
  return res.data; // { message }
};

// 👉 Toggle student active/inactive
export const toggleStudent = async (id, payload = {}) => {
  const res = await axios.patch(`${API_URL}/${id}/toggle`, payload);
  return res.data.student; // extract student
};

// 👉 Reset password
export const apiResetPassword = async (id) => {
  const res = await axios.post(`${API_URL}/${id}/reset-password`);
  return res.data; // ✅ Return full response { message, newPassword }
};

// 👉 Record lesson
export const recordLesson = async (id, lessonData) => {
  const res = await axios.post(`${API_URL}/${id}/lesson`, lessonData);
  return res.data; // { student, lesson }
};

// 👉 Add payment
export const addPayment = async (id, paymentData) => {
  const res = await axios.post(`${API_URL}/${id}/payment`, paymentData);
  return res.data; // { student, payment }
};

// 👉 Get payment history
export const getStudentPayments = async (id) => {
  const res = await axios.get(`${API_URL}/${id}/payments`);
  return res.data; // [payments]
};

// 👉 Get all payments (global)
export const getAllPayments = async () => {
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const res = await axios.get(`${BASE_URL}/api/payments`);
  return res.data;
};

// 👉 Get all lessons (global)
export const getAllLessons = async () => {
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const res = await axios.get(`${BASE_URL}/api/lessons`);
  return res.data;
};
