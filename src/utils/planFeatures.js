// src/utils/planFeatures.js
// What each center plan allows. Keep in sync with server/utils/planFeatures.js
// (the server enforces it; this copy is for labels and hiding UI).
export const STUDENT_MODES = {
  free:       { real: false, managed: true  },
  basic:      { real: false, managed: true  },
  pro:        { real: true,  managed: false },
  enterprise: { real: true,  managed: true  },
};

export const getStudentModes = (plan) => STUDENT_MODES[plan] || STUDENT_MODES.basic;

/** Short human label for a plan's student modes, e.g. "Managed students only". */
export const studentModesLabel = (plan) => {
  const m = getStudentModes(plan);
  if (m.real && m.managed) return "Student accounts + managed students";
  return m.real ? "Student accounts only" : "Managed students only";
};
