import api from "../api";

export const getTeachers = async () => {
  const res = await api.get("/api/teachers");
  return res.data;
};

export const createTeacher = async (teacher) => {
  const res = await api.post("/api/teachers", teacher);
  return res.data;
};

export const updateTeacher = async (id, teacher) => {
  const res = await api.put(`/api/teachers/${id}`, teacher);
  return res.data;
};

export const deleteTeacher = async (id) => {
  const res = await api.delete(`/api/teachers/${id}`);
  return res.data;
};