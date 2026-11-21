export const CLASS_REMINDER_LEAD = 5 * 60 * 1000;
export const reminderKey = lesson => String(lesson._id) + ':' + Date.parse(lesson.scheduledTime);
export function upcomingReminderClasses(work, now = Date.now()) {
  return work.filter(lesson => ['accepted', 'open', 'full'].includes(lesson.status)
    && Number.isFinite(Date.parse(lesson.scheduledTime)) && Date.parse(lesson.scheduledTime) > now)
    .sort((a, b) => Date.parse(a.scheduledTime) - Date.parse(b.scheduledTime));
}
export function dueClassReminders(work, now = Date.now()) {
  return upcomingReminderClasses(work, now).filter(lesson => Date.parse(lesson.scheduledTime) - now <= CLASS_REMINDER_LEAD);
}
