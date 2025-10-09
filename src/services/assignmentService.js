import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/assignments`;

export const getAssignments = async () => {
  const res = await axios.get(API_URL);
  return res.data;
};

export const createAssignment = async (data) => {
  const res = await axios.post(API_URL, data);
  return res.data.assignment;
};

export const deleteAssignment = async (id) => {
  const res = await axios.delete(`${API_URL}/${id}`);
  return res.data;
};