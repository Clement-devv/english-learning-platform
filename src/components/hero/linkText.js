// Text for the share-link pages (homework, quiz) — kept out of HeroLinkKit.jsx so that
// file only exports components and hooks.

/** Expired-link text: when it closed, and the one thing that helps (a new one from the teacher) */
export function endedText(what, endedAt) {
  const when = endedAt && !isNaN(new Date(endedAt))
    ? ` on ${new Date(endedAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`
    : "";
  return `This ${what} closed${when}, when its due date passed. If it still needs doing, please ask your teacher to send a new one.`;
}
