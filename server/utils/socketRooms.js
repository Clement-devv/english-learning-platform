// server/utils/socketRooms.js
// Room names for admin-facing Socket.IO content. No imports on purpose — used by
// liveUpdates.js (loaded from the schemas), routes and socketServer alike.
//
// admin-broadcast:<slug> is joined by admins AND sub-admins, so it only carries
// content-free signals ("data-changed"). Anything with content (message
// previews, class presence) goes to admins, plus the sub-admins whose teacher
// scope includes the teacher involved.
export const adminOnlyRoom       = (slug) => `admin-only:${slug}`;
export const subAdminTeacherRoom = (slug, teacherId) => `subadmin-teacher:${slug}:${teacherId}`;

/** Rooms that should receive admin-facing content about `teacherId`'s classes/chats. */
export function adminContentRooms(slug, teacherId) {
  return teacherId
    ? [adminOnlyRoom(slug), subAdminTeacherRoom(slug, String(teacherId))]
    : [adminOnlyRoom(slug)];
}
