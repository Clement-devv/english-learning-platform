// src/utils/quizPdf.js
// Quiz result report — the teacher downloads it and sends it to the parent.
// Layout kit: utils/heroPdf.js (same hero world as the kids' link pages).
import { HERO, scoreStamp } from "../components/hero/heroTheme";
import { createHeroReport, fmtDate, fileSafe } from "./heroPdf";

const LETTERS = ["A", "B", "C", "D"];

const fmtDuration = (sec) => {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m ? `${m} min ${s}s` : `${s}s`;
};

// options.output === "bloburl" returns a URL instead of downloading (for previews)
export async function downloadQuizResultPdf(quiz, teacherInfo, options = {}) {
  const attempt = quiz.attempt;
  const studentName = `${quiz.studentId?.firstName || ""} ${quiz.studentId?.lastName || ""}`.trim() || "Student";
  const teacherName = teacherInfo?.displayName?.trim() || `${teacherInfo?.firstName || ""} ${teacherInfo?.lastName || ""}`.trim() || "—";
  const pct = attempt?.percentage;

  const r = await createHeroReport({
    title: "Quiz Report",
    subtitle: `Quiz mission complete for ${studentName}!`,
    stripTitle: `${studentName} · ${quiz.title || "Quiz"}`,
  });

  r.summary({
    name: studentName,
    heading: quiz.title || "Quiz",
    cols: [["TEACHER", teacherName], ["TAKEN ON", fmtDate(attempt?.submittedAt)], ["TIME", fmtDuration(attempt?.timeTaken)]],
    badge: {
      big: attempt ? `${attempt.score}/${attempt.totalQuestions}` : "—",
      small: pct == null ? "" : `${pct}% CORRECT`,
      stamp: scoreStamp(pct),
    },
  });

  // Summary line + timing note
  if (attempt) {
    const right = attempt.score, total = attempt.totalQuestions;
    const skipped = (attempt.answers || []).filter(a => a == null || a < 0).length;
    const lines = [{ text: `${right} of ${total} answers correct${skipped ? ` · ${skipped} skipped` : ""} · time limit ${quiz.timeLimit} min.`, size: 11.5 }];
    if (attempt.overTime) lines.push({ text: "Finished after the time limit.", size: 9.5, color: HERO.redDeep });
    r.textCard("How it went", HERO.sun, lines, "#FFFBEA");
  }

  if (quiz.instructions) r.textCard("The mission", HERO.blue, [{ text: quiz.instructions, size: 11, color: HERO.inkSoft }]);

  // Every question with the student's answer, the right answer and the explanation
  const rows = [];
  (quiz.questions || []).forEach((q, i) => {
    const given = attempt?.answers?.[i];
    const ok = given === q.correctIndex;
    const optText = (idx) => (idx == null || idx < 0 || !q.options[idx]) ? "No answer" : `${LETTERS[idx]}. ${q.options[idx].text}`;
    rows.push({ group: i, text: `${i + 1}. ${q.question}`, style: r.F.bodyBold, size: 11, indent: 8, marker: ok, gap: 1.5 });
    rows.push({ group: i, text: `Answer: ${optText(given)}`, size: 10, indent: 8, color: ok ? "#138A5A" : HERO.redDeep, gap: 1 });
    if (!ok) rows.push({ group: i, text: `Correct: ${optText(q.correctIndex)}`, size: 10, indent: 8, color: "#138A5A", gap: 1 });
    if (q.explanation) rows.push({ group: i, text: q.explanation, size: 9.5, indent: 8, color: HERO.inkSoft, gap: 1 });
    rows[rows.length - 1].gap = 5; // space between questions
  });
  if (rows.length) r.textCard("Answers", HERO.red, rows);

  r.signOff(pct >= 75 ? "Amazing work, hero!" : "Keep practising, hero. You've got this!", `Quiz set by ${teacherName} · due ${fmtDate(quiz.dueDate)}`);
  return r.finish(`${fileSafe(studentName)}-${fileSafe(quiz.title || "quiz")}`, options);
}
