// server/utils/planFeatures.js
// What each center plan allows. Keep in sync with src/utils/planFeatures.js.
//
// Student modes:
//   real    — invited student accounts that log in themselves
//   managed — no-login students run by the center admin
const STUDENT_MODES = {
  free:       { real: false, managed: true  },
  basic:      { real: false, managed: true  },
  pro:        { real: true,  managed: false },
  enterprise: { real: true,  managed: true  },
};

/** Student modes allowed for a plan. Unknown plans fall back to basic. */
export const getStudentModes = (plan) => STUDENT_MODES[plan] || STUDENT_MODES.basic;

export const PLAN_UPGRADE_MSG = {
  real:    "Your plan doesn't include student accounts. Contact your platform admin to upgrade to Pro or Enterprise.",
  managed: "Your plan doesn't include managed students. Contact your platform admin to switch to Basic or Enterprise.",
};

/**
 * Returns an error message if the center's plan does not allow creating
 * students of this mode, otherwise null. Only gates *creation* — existing
 * students keep working after a plan change, so nobody is locked out.
 */
export const planBlocksStudentMode = (center, mode) =>
  getStudentModes(center?.plan)[mode] ? null : PLAN_UPGRADE_MSG[mode];
