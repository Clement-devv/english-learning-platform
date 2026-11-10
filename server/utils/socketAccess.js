// server/utils/socketAccess.js
// Who may join which Socket.IO room, and which rooms carry admin-only content.
//
// A client can emit to any room name it likes, so rooms are checked twice:
//   • on join   — the real check (class membership / chat membership)
//   • on emit   — the event is dropped unless that join was approved
// Results are cached per socket as promises, so an event sent right after its
// join waits for the verdict instead of being dropped or let through.
import mongoose from "mongoose";
import { getDb } from "../config/dbManager.js";
import { canAccessClass, parseChannel } from "./classAccess.js";
import { groupChatSchema } from "../schemas/groupChatSchema.js";
import { directMessageSchema } from "../schemas/directMessageSchema.js";
import { getUserModelForRole, isAccountUsable } from './roleModels.js';
import { buildRoleClaims } from './sessionClaims.js';

const getGroupChat     = (db) => db.models.GroupChat     || db.model("GroupChat",     groupChatSchema);
const getDirectMessage = (db) => db.models.DirectMessage || db.model("DirectMessage", directMessageSchema);

export { adminOnlyRoom, subAdminTeacherRoom, adminContentRooms } from "./socketRooms.js";

// ── Membership checks ────────────────────────────────────────────────────────

/** Same rule as GET /group-chats/:id/messages and directMessageRoutes canAccess(). */
async function canAccessChat(socket, chatId) {
  if (!mongoose.isValidObjectId(chatId)) return false;
  const { role, id: userId, teacherScope = [] } = socket.authUser;
  const db = await getDb(socket.centerId);

  const gc = await getGroupChat(db).findById(chatId).select("teacherId studentId").lean();
  if (gc) {
    if (role === "admin")     return true;
    if (role === "teacher")   return String(gc.teacherId) === String(userId);
    if (role === "student")   return String(gc.studentId) === String(userId);
    if (role === "sub-admin") return teacherScope.map(String).includes(String(gc.teacherId));
    return false;
  }

  const dm = await getDirectMessage(db).findById(chatId).select("teacherId studentId subAdminId").lean();
  if (!dm) return false;
  if (role === "admin")     return true;
  if (role === "teacher")   return String(dm.teacherId)  === String(userId);
  if (role === "student")   return String(dm.studentId)  === String(userId);
  if (role === "sub-admin") return String(dm.subAdminId) === String(userId);
  return false;
}

async function canAccessChannel(socket, channelName) {
  const target = parseChannel(channelName);
  if (!target) return false;
  const db = await getDb(socket.centerId);
  return canAccessClass({ db, user: socket.authUser }, target.kind, target.id);
}

function cached(socket, key, check) {
  if (!socket.accessCache) socket.accessCache = new Map();
  if (!socket.accessCache.has(key)) {
    if (socket.accessCache.size > 200) socket.accessCache.clear(); // bound memory per socket
    socket.accessCache.set(key, check().catch(() => false));
  }
  return socket.accessCache.get(key);
}

/** Verify (once) that this socket may use a class channel ("class-<id>" / "group-<id>"). */
export const verifyChannel = (socket, channelName) =>
  cached(socket, `ch:${channelName}`, () => canAccessChannel(socket, String(channelName || "")));

/** Verify (once) that this socket may use a chat (group chat or direct message). */
export const verifyChat = (socket, chatId) =>
  cached(socket, `chat:${chatId}`, () => canAccessChat(socket, String(chatId || "")));

/** For emits: true only if the matching join was approved (waits if still checking). */
export const joinedChannel = async (socket, channelName) =>
  !!(await socket.accessCache?.get(`ch:${channelName}`));
export const joinedChat = async (socket, chatId) =>
  !!(await socket.accessCache?.get(`chat:${chatId}`));

// Recheck passive listeners too. A disconnect also revokes broadcast-room
// subscriptions that were derived from a sub-admin's previous teacher scope.
export async function refreshSocketAccess(socket) {
  const db = await getDb(socket.centerId);
  if (!socket.isImpersonation) {
    const Model = getUserModelForRole(db, socket.authUser.role);
    if (!Model) return false;
    const user = await Model.findById(socket.authUser.id)
      .select('active status assignedTeachers assignmentType region permissions').lean();
    if (!isAccountUsable(socket.authUser.role, user)) return false;
    if (socket.authUser.role === 'sub-admin') {
      const claims = await buildRoleClaims('sub-admin', user, db);
      if (JSON.stringify([...claims.teacherScope].sort()) !== JSON.stringify([...socket.authUser.teacherScope].sort())) return false;
    }
  }
  for (const [key, grant] of socket.accessCache || []) {
    if (!(await grant)) continue;
    const allowed = key.startsWith('ch:')
      ? await canAccessChannel(socket, key.slice(3)) : await canAccessChat(socket, key.slice(5));
    if (!allowed) return false;
  }
  return true;
}
