// src/components/chat/MessageAlert.jsx
// Floating alert shown at the top of the dashboard when there are unread chat
// messages (group chats + direct messages).
// - Appears immediately when the user comes online / logs in (RingContext fetches
//   /group-chats + /direct-messages and sums unreadCount for the current role).
// - Dismissed when the user clicks it OR opens the Messages tab (markMessagesSeen
//   in RingContext writes a lastSeenAt timestamp to localStorage so refresh does
//   NOT re-show until a brand-new message arrives).
// - Only renders on dashboard routes — never on login / public pages.
// - When the missed-call banner is also visible, this one stacks below it.

import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useRing } from "../../context/RingContext";
import { MessageCircle } from "lucide-react";
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

export default function MessageAlert() {
  const { role } = useAuth();
  const { unreadMessageCount, markMessagesSeen, missedCallCount } = useRing();
  const location = useLocation();

  if (!role) return null;
  if (!isDashboardPath(location.pathname)) return null;
  if (unreadMessageCount === 0) return null;

  // Stacks below the missed-call card when both are visible.
  return (
    <DashToast
      tone="accent"
      icon={MessageCircle}
      count={unreadMessageCount}
      title={`${unreadMessageCount} new message${unreadMessageCount > 1 ? "s" : ""}`}
      sub="Open Messages to read"
      onDismiss={markMessagesSeen}
      offset={missedCallCount > 0 ? 1 : 0}
    />
  );
}
