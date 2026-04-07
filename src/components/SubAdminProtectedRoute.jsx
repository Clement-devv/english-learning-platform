// src/components/SubAdminProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function SubAdminProtectedRoute({ children }) {
  const token      = sessionStorage.getItem("subAdminToken") || localStorage.getItem("subAdminToken");
  const subAdminInfo = sessionStorage.getItem("subAdminInfo") || localStorage.getItem("subAdminInfo");

  if (!token || !subAdminInfo) {
    return <Navigate to="/sub-admin/login" replace />;
  }

  // Basic token expiry check (decode without verifying signature)
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem("subAdminToken"); localStorage.removeItem("subAdminToken");
      sessionStorage.removeItem("subAdminInfo");  localStorage.removeItem("subAdminInfo");
      return <Navigate to="/sub-admin/login" replace />;
    }
  } catch {
    // Malformed token
    sessionStorage.removeItem("subAdminToken"); localStorage.removeItem("subAdminToken");
    sessionStorage.removeItem("subAdminInfo");  localStorage.removeItem("subAdminInfo");
    return <Navigate to="/sub-admin/login" replace />;
  }

  return children;
}
