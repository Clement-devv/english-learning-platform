// Quiz emails. Student emails follow the student's emailLanguage (i18n.js).
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

const fullName = (u) => esc(`${u?.firstName || ""} ${u?.lastName || ""}`.trim());

const ASSIGNED = {
  en: {
    subject: (t) => `New quiz – ${t}`, eyebrow: "New quiz",
    intro: (n, t) => `Hi ${n}, <strong>${t}</strong> has set you a quiz.`,
    labels: ["Questions", "Time limit", "Due", "Teacher"], minutes: "minutes",
    note: "<strong>One attempt only.</strong> Once you start, the timer can't be paused — start when you're ready.",
    cta: "Take the quiz",
  },
  vi: {
    subject: (t) => `Bài kiểm tra mới – ${t}`, eyebrow: "Bài kiểm tra mới",
    intro: (n, t) => `Chào ${n}, <strong>${t}</strong> vừa giao cho em một bài kiểm tra.`,
    labels: ["Số câu hỏi", "Thời gian làm bài", "Hạn nộp", "Giáo viên"], minutes: "phút",
    note: "<strong>Chỉ được làm một lần.</strong> Khi đã bắt đầu, đồng hồ không thể tạm dừng — hãy bắt đầu khi em đã sẵn sàng.",
    cta: "Làm bài kiểm tra",
  },
};
export const sendQuizAssigned = async (student, teacher, quiz, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(ASSIGNED, lang), tz = student?.timezone, L = s.labels;
  const due = fmtDate(quiz.dueDate, lang, tz);
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(quiz.title),
    html: renderEmail({
      ...b, lang, tone: "blue",
      preheader: `${L[2]}: ${due}`,
      eyebrow: s.eyebrow,
      title: quiz.title,
      body:
        p(s.intro(esc(student.firstName), fullName(teacher))) +
        details([
          [L[0], String(quiz.questions?.length ?? "")],
          [L[1], `${quiz.timeLimit} ${s.minutes}`],
          [L[2], due],
          [L[3], fullName(teacher)],
        ]) +
        callout(s.note, "amber"),
      cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard?tab=quiz`, tone: "blue" },
    }),
  });
};

// Teacher (English)
export const sendQuizCompleted = async (teacher, student, quiz, attempt, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const pct = attempt.percentage;
  const tone = pct >= 80 ? "green" : pct >= 60 ? "amber" : "red";
  const trophy = pct >= 90 ? "🏆" : pct >= 75 ? "🥇" : pct >= 60 ? "🥈" : "🥉";
  const took = attempt.timeTaken ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s` : "";
  return sendEmail({
    centerName: b.centerName,
    to: teacher.email,
    subject: `Quiz completed – ${quiz.title} – ${student.firstName} ${student.lastName} scored ${pct}%`,
    html: renderEmail({
      ...b, tone,
      preheader: `${student.firstName} scored ${pct}% (${attempt.score}/${attempt.totalQuestions})`,
      eyebrow: "Quiz completed",
      title: `${trophy} ${student.firstName} scored ${pct}%`,
      body:
        p(`Hi ${esc(teacher.firstName)}, <strong>${fullName(student)}</strong> has finished the quiz.`) +
        details([
          ["Quiz", esc(quiz.title)],
          ["Score", `${attempt.score} / ${attempt.totalQuestions} correct (${pct}%)`],
          ["Time taken", took],
        ]),
      cta: { label: "View results", href: `${b.baseUrl}/teacher/dashboard?tab=quiz`, tone: tone === "red" ? "accent" : tone },
    }),
  });
};

const DUE = {
  en: {
    subject: (t, m) => `Quiz due in ${m} minutes – ${t}`, eyebrow: "Due soon",
    intro: (n) => `Hi ${n}, your quiz is due very soon.`,
    labels: ["Quiz", "Due at", "Time left"], left: (m) => `${m} minutes`,
    note: (l) => `<strong>One attempt only.</strong> Once you start, the ${l}-minute timer begins straight away.`,
    cta: "Take the quiz now",
  },
  vi: {
    subject: (t, m) => `Bài kiểm tra hết hạn sau ${m} phút – ${t}`, eyebrow: "Sắp hết hạn",
    intro: (n) => `Chào ${n}, bài kiểm tra của em sắp hết hạn.`,
    labels: ["Bài kiểm tra", "Hạn nộp lúc", "Còn lại"], left: (m) => `${m} phút`,
    note: (l) => `<strong>Chỉ được làm một lần.</strong> Khi bắt đầu, đồng hồ ${l} phút sẽ chạy ngay.`,
    cta: "Làm bài ngay",
  },
};
export const sendQuizDueReminder = async (student, quiz, minutesLeft, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(DUE, lang), tz = student?.timezone;
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(quiz.title, minutesLeft),
    html: renderEmail({
      ...b, lang, tone: "amber",
      preheader: s.intro(student.firstName),
      eyebrow: s.eyebrow,
      title: quiz.title,
      body:
        p(s.intro(esc(student.firstName))) +
        details([
          [s.labels[0], esc(quiz.title)],
          [s.labels[1], fmtTime(quiz.dueDate, lang, tz)],
          [s.labels[2], `<span style="color:#b45309;">${s.left(minutesLeft)}</span>`],
        ]) +
        callout(s.note(quiz.timeLimit), "amber"),
      cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard?tab=quiz`, tone: "amber" },
    }),
  });
};
