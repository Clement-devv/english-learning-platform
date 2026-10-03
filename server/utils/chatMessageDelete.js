// server/utils/chatMessageDelete.js
// "Delete for everyone" for chat messages (group chats and direct messages).
// Only the sender may delete, and only within DELETE_WINDOW_MS of sending.
// The message stays in the thread as a "This message was deleted" placeholder
// so the other side isn't confused by a gap; its text is erased.

export const DELETE_WINDOW_MS = 30 * 60 * 1000;
export const DELETED_TEXT = "This message was deleted";

/**
 * Soft-delete one message on a chat document (DirectMessage or GroupChat).
 * Does not save — the caller saves the document.
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export function deleteOwnMessage(chatDoc, messageId, userId, role) {
  const msg = chatDoc.messages.id(messageId);
  if (!msg) return { ok: false, status: 404, message: "Message not found" };
  if (msg.deleted) return { ok: false, status: 400, message: "This message was already deleted" };

  const isSender = String(msg.senderId) === String(userId) && (!msg.senderRole || msg.senderRole === role);
  if (!isSender) return { ok: false, status: 403, message: "You can only delete your own messages" };

  const age = Date.now() - new Date(msg.createdAt).getTime();
  if (age > DELETE_WINDOW_MS) {
    return { ok: false, status: 400, message: "Messages can only be deleted within 30 minutes of sending" };
  }

  msg.message   = DELETED_TEXT;
  msg.deleted   = true;
  msg.deletedAt = new Date();
  if (msg.fileUrl)  msg.fileUrl  = undefined;
  if (msg.fileName) msg.fileName = undefined;

  // Keep the chat-list preview honest if this was the latest message
  const last = chatDoc.messages[chatDoc.messages.length - 1];
  if (last && String(last._id) === String(msg._id) && chatDoc.lastMessage) {
    chatDoc.lastMessage.text = DELETED_TEXT;
  }
  return { ok: true };
}
