// src/components/ring/MissedCallAlert.jsx
// Floating alert shown at the top of the dashboard when there are unread missed calls.
// - Appears immediately when the user comes online / logs in (RingContext fetches /ring/missed-calls).
// - Dismissed when the user clicks it OR opens the Ring tab (clearMissedCalls in RingContext
//   also writes a lastSeenAt timestamp to localStorage so refresh does NOT re-show it).
// - Only renders on dashboard routes — never on login / public pages.

import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useRing } from "../../context/RingContext";
import { PhoneMissed } from "lucide-react";
import DashToast from "../DashToast";

const DASHBOARD_PATHS = [
  "/student/dashboard",
  "/teacher/dashboard",
  "/admin",
  "/sub-admin/dashboard",
  "/parent/dashboard",
];

function isDashboardPath(path) {
  return DASHBOARD_PATHS.some((p) => path.startsWith(p));
}

export default function MissedCallAlert() {
  const { role } = useAuth();
  const { missedCallCount, clearMissedCalls } = useRing();
  const location = useLocation();

  if (!role) return null;
  if (!isDashboardPath(location.pathname)) return null;
  if (missedCallCount === 0) return null;

  return (
    <DashToast
      tone="red"
      icon={PhoneMissed}
      count={missedCallCount}
      title={`${missedCallCount} missed call${missedCallCount > 1 ? "s" : ""}`}
      sub="Open Ring to see who called"
      onDismiss={clearMissedCalls}
    />
  );
}
