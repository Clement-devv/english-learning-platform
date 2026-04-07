import api from "../api";

export const getAssignments = async () => {
  const res = await api.get("/assignments");
  return res.data;
};

export const createAssignment = async (data) => {
  const res = await api.post("/assignments", data);
  return res.data.assignment;
};

export const deleteAssignment = async (id) => {
  const res = await api.delete(`/assignments/${id}`);
  return res.data;
};
