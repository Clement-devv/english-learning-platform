// src/components/groupClass/joinGroupClass.js
// Join a group class on its platform: Agora opens the in-app classroom (onAgora);
// Google Meet / Zoom open the class link in a new tab. The link comes from the
// server (GET /group-classes/:id/join), which only gives it to people in the class.
import api from "../../api";

// before: optional async step first (the teacher's "Start"), run after the tab is open
export async function joinGroupClass(gc, { onAgora, onError, before }) {
  if ((gc.platform || "agora") === "agora") {
    try { await before?.(); } catch (e) { return onError?.(e.response?.data?.message || "Could not start the class"); }
    // Records that this person joined (the auto-close after class time uses it)
    try { await api.get(`/group-classes/${gc._id}/join`); }
    catch (e) { if (e.response?.status === 403 || e.response?.status === 400) return onError?.(e.response.data?.message || "Could not open the class"); }
    return onAgora(gc);
  }
  // Open the tab now, while the click still counts as the user's — opening it
  // after waiting for the server would be stopped by the pop-up blocker.
  const tab = window.open("", "_blank");
  try {
    await before?.();
    const { data } = await api.get(`/group-classes/${gc._id}/join`);
    if (data.platform === "agora") { tab?.close(); return onAgora(gc); }
    if (tab) {
      tab.opener = null; // the meeting page can't reach back into this app
      tab.location.href = data.link;
    } else {
      window.open(data.link, "_blank", "noopener,noreferrer");
    }
  } catch (e) {
    tab?.close();
    onError?.(e.response?.data?.message || "Could not open the class");
  }
}
