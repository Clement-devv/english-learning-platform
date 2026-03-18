// server/utils/progressReportGenerator.js
// Generates a PDF progress report for a student covering a date range.
// Returns a Buffer containing the PDF bytes.

import PDFDocument from "pdfkit";
import Booking     from "../models/Booking.js";
import Homework    from "../models/Homework.js";
import QuizAttempt from "../models/QuizAttempt.js";
import VocabProgress from "../models/VocabProgress.js";

// ── Brand colours ─────────────────────────────────────────────────────────────
const GREEN  = "#16a34a";
const DARK   = "#1e293b";
const MUTED  = "#64748b";
const LIGHT  = "#f0fdf4";
const WHITE  = "#ffffff";

// ── Helpers ───────────────────────────────────────────────────────────────────
function monthName(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmt(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function drawHRule(doc, y, color = "#e2e8f0") {
  doc.save().strokeColor(color).lineWidth(1)
     .moveTo(40, y).lineTo(doc.page.width - 40, y).stroke().restore();
}

function badge(score) {
  if (score >= 90) return "🥇 Excellent";
  if (score >= 75) return "🥈 Good";
  if (score >= 60) return "🥉 Passed";
  return "📚 Keep Practising";
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * @param {Object} student  - Student doc (firstName, surname, email)
 * @param {Object} teacher  - Teacher doc (firstName, lastName) or null
 * @param {Date}   from     - Start of reporting window
 * @param {Date}   to       - End of reporting window (exclusive)
 * @param {"weekly"|"monthly"} period
 * @returns {Promise<Buffer>}
 */
export async function generateProgressReport(student, teacher, from, to, period = "monthly") {
  // ── Gather data ─────────────────────────────────────────────────────────────
  const [completedBookings, gradedHW, quizAttempts, vocabStats] = await Promise.all([
    Booking.find({
      studentId: student._id,
      status: "completed",
      scheduledTime: { $gte: from, $lt: to },
    }).populate("teacherId", "firstName lastName"),

    Homework.find({
      studentId: student._id,
      status: "graded",
      "grade.gradedAt": { $gte: from, $lt: to },
    }),

    QuizAttempt.find({
      studentId: student._id,
      submittedAt: { $gte: from, $lt: to },
    }).populate("quizId", "title"),

    VocabProgress.find({
      studentId: student._id,
      lastReviewedAt: { $gte: from, $lt: to },
    }),
  ]);

  // Derived stats
  const totalClasses = completedBookings.length;
  const totalMinutes = totalClasses * 60; // assume 1h sessions

  const hwScores = gradedHW.map(h => h.grade?.score ?? 0).filter(s => s !== null);
  const avgHW    = hwScores.length ? Math.round(hwScores.reduce((a, b) => a + b, 0) / hwScores.length) : null;

  const quizScores = quizAttempts.map(a => a.percentage ?? 0);
  const avgQuiz    = quizScores.length ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

  const vocabReviewed = vocabStats.length;
  const vocabMastered = vocabStats.filter(v => v.repetitions >= 3).length;

  // Overall score for badge
  const scores = [avgHW, avgQuiz].filter(s => s !== null);
  const overallAvg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // ── Build PDF ────────────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const pad = 40;

    // ── Header banner ──────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 110).fill(GREEN);
    doc.fillColor(WHITE)
       .font("Helvetica-Bold").fontSize(22)
       .text("English Learning Platform", pad, 22);
    doc.font("Helvetica").fontSize(12)
       .text(`${period === "weekly" ? "Weekly" : "Monthly"} Progress Report`, pad, 50);
    doc.font("Helvetica-Bold").fontSize(11)
       .text(`${fmt(from)} – ${fmt(new Date(to - 1))}`, pad, 68);
    doc.fillColor(WHITE).font("Helvetica").fontSize(10)
       .text("Generated automatically · Confidential", pad, 88);

    let y = 130;

    // ── Student info ───────────────────────────────────────────────────────────
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(16)
       .text(`${student.firstName} ${student.surname}`, pad, y);
    y += 22;
    doc.fillColor(MUTED).font("Helvetica").fontSize(10)
       .text(student.email, pad, y);
    if (teacher) {
      doc.text(`Teacher: ${teacher.firstName} ${teacher.lastName}`, pad, y + 14);
      y += 14;
    }
    y += 28;
    drawHRule(doc, y);
    y += 16;

    // ── Overall badge ──────────────────────────────────────────────────────────
    if (overallAvg !== null) {
      doc.rect(pad, y, W - pad * 2, 44).fill(LIGHT);
      doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(14)
         .text(badge(overallAvg), pad + 12, y + 8);
      doc.fillColor(MUTED).font("Helvetica").fontSize(10)
         .text(`Overall average score: ${overallAvg}%`, pad + 12, y + 26);
      y += 60;
    }

    // ── Section: Classes ───────────────────────────────────────────────────────
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(13)
       .text("📅  Classes", pad, y);
    y += 18;
    drawHRule(doc, y, GREEN);
    y += 10;

    if (totalClasses === 0) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(10)
         .text("No completed classes in this period.", pad, y);
      y += 20;
    } else {
      doc.fillColor(DARK).font("Helvetica").fontSize(10)
         .text(`Completed classes: ${totalClasses}   ·   Total study time: ~${totalMinutes} min`, pad, y);
      y += 18;

      for (const booking of completedBookings) {
        const t = booking.teacherId;
        const tName = t ? `${t.firstName} ${t.lastName}` : "Teacher";
        doc.fillColor(MUTED).fontSize(9)
           .text(`  • ${fmt(booking.scheduledTime)}  —  with ${tName}`, pad + 8, y);
        y += 14;
        if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
      }
    }
    y += 10;

    // ── Section: Homework ──────────────────────────────────────────────────────
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(13)
       .text("📝  Homework", pad, y);
    y += 18;
    drawHRule(doc, y, GREEN);
    y += 10;

    if (gradedHW.length === 0) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(10)
         .text("No graded homework in this period.", pad, y);
      y += 20;
    } else {
      doc.fillColor(DARK).font("Helvetica").fontSize(10)
         .text(`Graded assignments: ${gradedHW.length}   ·   Average score: ${avgHW ?? "N/A"}%`, pad, y);
      y += 18;

      for (const hw of gradedHW) {
        const score = hw.grade?.score != null ? `${hw.grade.score}%` : "—";
        doc.fillColor(MUTED).fontSize(9)
           .text(`  • "${hw.title}"  →  ${score}`, pad + 8, y);
        y += 14;
        if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
      }
    }
    y += 10;

    // ── Section: Quizzes ───────────────────────────────────────────────────────
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(13)
       .text("🧠  Quizzes", pad, y);
    y += 18;
    drawHRule(doc, y, GREEN);
    y += 10;

    if (quizAttempts.length === 0) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(10)
         .text("No quiz attempts in this period.", pad, y);
      y += 20;
    } else {
      doc.fillColor(DARK).font("Helvetica").fontSize(10)
         .text(`Quizzes taken: ${quizAttempts.length}   ·   Average score: ${avgQuiz ?? "N/A"}%`, pad, y);
      y += 18;

      for (const attempt of quizAttempts) {
        const title = attempt.quizId?.title ?? "Quiz";
        const pct   = attempt.percentage != null ? `${attempt.percentage}%` : "—";
        doc.fillColor(MUTED).fontSize(9)
           .text(`  • "${title}"  →  ${pct}  (${fmt(attempt.submittedAt)})`, pad + 8, y);
        y += 14;
        if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
      }
    }
    y += 10;

    // ── Section: Vocabulary ────────────────────────────────────────────────────
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(13)
       .text("📖  Vocabulary", pad, y);
    y += 18;
    drawHRule(doc, y, GREEN);
    y += 10;

    if (vocabReviewed === 0) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(10)
         .text("No flashcard reviews in this period.", pad, y);
      y += 20;
    } else {
      doc.fillColor(DARK).font("Helvetica").fontSize(10)
         .text(`Cards reviewed: ${vocabReviewed}   ·   Mastered (≥3 reps): ${vocabMastered}`, pad, y);
      y += 20;
    }
    y += 10;

    // ── Footer ─────────────────────────────────────────────────────────────────
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      const footerY = doc.page.height - 30;
      drawHRule(doc, footerY - 8);
      doc.fillColor(MUTED).font("Helvetica").fontSize(8)
         .text(
           `English Learning Platform  ·  Page ${i + 1} of ${pages.count}  ·  ${monthName(from)}`,
           pad, footerY, { align: "center", width: W - pad * 2 }
         );
    }

    doc.end();
  });
}
