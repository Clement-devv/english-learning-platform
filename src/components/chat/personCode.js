// src/components/chat/personCode.js
// The ID number (TCH-12345 / STU-12345) of the OTHER person in a direct-message
// chat — names repeat across countries, IDs don't. Empty when there isn't one.
export function otherPersonCode(dm, userRole) {
  if (!dm) return "";
  const t = dm.teacherId?.teacherCode || "", s = dm.studentId?.studentId || "";
  if (userRole === "admin" || userRole === "sub-admin") {
    if (dm.type === "teacher-admin" || dm.type === "sub-admin-teacher") return t;
    if (dm.type === "student-admin") return s;
  }
  return "";
}

/** Small monospace chip for an ID number. */
export const codeChipStyle = (isDark) => ({
  fontSize: "10px", fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  padding: "1px 6px", borderRadius: "6px", flexShrink: 0, letterSpacing: ".02em",
  color: isDark ? "#cbd5e1" : "#475569", background: isDark ? "rgba(148,163,184,0.18)" : "#f1f5f9",
  border: `1px solid ${isDark ? "rgba(148,163,184,0.3)" : "#e2e8f0"}`,
});
