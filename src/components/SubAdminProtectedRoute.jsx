// src/components/SubAdminProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function SubAdminProtectedRoute({ children }) {
  const token     = localStorage.getItem("subAdminToken");
  const subAdminInfo = localStorage.getItem("subAdminInfo");

  if (!token || !subAdminInfo) {
    return <Navigate to="/sub-admin/login" replace />;
  }

  // Basic token expiry check (decode without verifying signature)
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("subAdminToken");
      localStorage.removeItem("subAdminInfo");
      return <Navigate to="/sub-admin/login" replace />;
    }
  } catch {
    // Malformed token
    localStorage.removeItem("subAdminToken");
    localStorage.removeItem("subAdminInfo");
    return <Navigate to="/sub-admin/login" replace />;
  }

  return children;
}
