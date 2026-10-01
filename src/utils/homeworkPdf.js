// src/utils/homeworkPdf.js
// Graded homework report — the teacher downloads it and sends it to the parent.
// Layout kit: utils/heroPdf.js (same hero world as the kids' link page).
import { HERO, scoreStamp } from "../components/hero/heroTheme";
import { createHeroReport, loadImage, fmtDate, fileSafe } from "./heroPdf";

// options.output === "bloburl" returns a URL instead of downloading (for previews)
export async function downloadGradedHomeworkPdf(hw, teacherInfo, options = {}) {
  const studentName = `${hw.studentId?.firstName || ""} ${hw.studentId?.lastName || ""}`.trim() || "Student";
  const teacherName = teacherInfo?.displayName?.trim() || `${teacherInfo?.firstName || ""} ${teacherInfo?.lastName || ""}`.trim() || "—";
  const score = hw.grade?.score;

  const r = await createHeroReport({
    title: "Homework Report",
    subtitle: `Mission complete for ${studentName}!`,
    stripTitle: `${studentName} · ${hw.title || "Homework"}`,
  });

  r.summary({
    name: studentName,
    heading: hw.title || "Homework",
    cols: [["TEACHER", teacherName], ["DUE", fmtDate(hw.dueDate)], ["SUBMITTED", fmtDate(hw.submission?.submittedAt)]],
    badge: { big: score == null ? "—" : String(score), small: "OUT OF 100", stamp: scoreStamp(score) },
  });

  if (hw.grade?.feedback || hw.grade?.audioFeedback?.fileId) {
    r.textCard("Teacher's feedback", HERO.sun, [
      ...(hw.grade?.feedback ? [{ text: hw.grade.feedback, size: 12.5 }] : []),
      ...(hw.grade?.audioFeedback?.fileId ? [{ text: "The teacher also recorded voice feedback.", size: 9.5, color: HERO.inkSoft }] : []),
    ], "#FFFBEA");
  }

  if (hw.description) r.textCard("The mission", HERO.blue, [{ text: hw.description, size: 11, color: HERO.inkSoft }]);

  const attachments = hw.submission?.attachments || [];
  const photos = attachments.filter(a => a.mimeType?.startsWith("image/"));
  const others = attachments.filter(a => !a.mimeType?.startsWith("image/"));
  const answer = [];
  if (hw.submission?.text) answer.push({ text: hw.submission.text, size: 11.5, gap: 4 });
  if (hw.submission?.audio?.fileId) answer.push({ text: "The student also recorded a voice answer.", size: 9.5, color: HERO.inkSoft });
  if (others.length) answer.push({ text: `Attached files: ${others.map(a => a.originalName).join(", ")}`, size: 9.5, color: HERO.inkSoft });
  if (photos.length) answer.push({ text: `${photos.length} photo${photos.length > 1 ? "s" : ""} of the student's work ${photos.length > 1 ? "are" : "is"} below.`, size: 9.5, color: HERO.inkSoft });
  if (!answer.length) answer.push({ text: "No answer was submitted.", size: 10, color: HERO.inkSoft });
  r.textCard("Student's answer", HERO.red, answer);

  for (const a of photos) {
    const img = await loadImage(`/homework/file/submission/${a.fileId}`);
    if (img) r.photo(img, a.mimeType);
    else r.textCard("Photo", HERO.green, [{ text: `Could not include: ${a.originalName}`, size: 9.5, color: HERO.inkSoft }]);
  }

  r.signOff("Keep up the great work, hero!", `Graded on ${fmtDate(hw.grade?.gradedAt)} by ${teacherName}`);
  return r.finish(`${fileSafe(studentName)}-${fileSafe(hw.title || "homework")}`, options);
}
