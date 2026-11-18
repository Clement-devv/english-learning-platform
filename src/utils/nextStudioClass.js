export function nextStudioClass(work, currentId, now = Date.now()) {
  const current = work.find(lesson => String(lesson._id) === String(currentId));
  const after = current ? Date.parse(current.scheduledTime) : -Infinity;
  return work.filter(lesson => String(lesson._id) !== String(currentId)
    && ['accepted', 'open', 'full', 'in-progress'].includes(lesson.status)
    && Date.parse(lesson.scheduledTime) >= after
    && Date.parse(lesson.scheduledTime) + (lesson.duration || 60) * 60000 > now)
    .sort((a, b) => Date.parse(a.scheduledTime) - Date.parse(b.scheduledTime))[0] || null;
}
