export function standaloneMailRecipients(teacherEmail, centerEmail) {
  if (!centerEmail || teacherEmail.trim().toLowerCase() === centerEmail.trim().toLowerCase()) return teacherEmail;
  return [teacherEmail, centerEmail];
}
