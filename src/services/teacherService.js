import api from "../api";

// Whole directory (screens filter/page it) — the API defaults to 50 otherwise
export const getTeachers = async () => {
  const res = await api.get("/teachers", { params: { limit: 5000 } });
  return res.data;
};

export const createTeacher = async (teacher) => {
  const res = await api.post("/teachers", teacher);
  return res.data;
};

export const updateTeacher = async (id, teacher) => {
  const res = await api.put(`/teachers/${id}`, teacher);
  return res.data;
};

export const deleteTeacher = async (id) => {
  const res = await api.delete(`/teachers/${id}`);
  return res.data;
};

export const restoreTeacher = async (id) => {
  const res = await api.post(`/teachers/${id}/restore`);
  return res.data;
};