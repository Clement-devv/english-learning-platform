// Renders every email with the shared layout and checks the language switch:
// student emails follow student.emailLanguage, everyone else gets English.
import { describe, it, expect, vi, beforeEach } from "vitest";

const sent = [];
vi.mock("../emails/core.js", () => ({
  sendEmail: vi.fn(async (o) => { sent.push(o); return { success: true }; }),
  getCenterBaseUrl: () => ({ baseUrl: "https://demo.example.com", needsSlug: false }),
}));

const B = await import("../emails/bookingEmails.js");
const H = await import("../emails/homeworkEmails.js");
const Q = await import("../emails/quizEmails.js");
const A = await import("../emails/authEmails.js");
const AC = await import("../emails/accountEmails.js");
const R = await import("../emails/reportEmails.js");
const L = await import("../emails/lessonEmails.js");
const AE = await import("../emails/adminEmailChangeEmails.js");

const center = { centerName: "Sunshine English", slug: "sunshine", branding: {} };
const when = new Date("2026-10-20T09:30:00Z");
const student = (lang) => ({ firstName: "Minh", lastName: "Tran", email: "minh@example.com", classCredits: 5, emailLanguage: lang, timezone: "Asia/Ho_Chi_Minh" });
const teacher = { firstName: "Lan", lastName: "Nguyen", email: "lan@example.com", ratePerClass: 12, timezone: "Asia/Ho_Chi_Minh" };
const booking = { classTitle: "IELTS <Speaking>", topic: "Places", scheduledTime: when, duration: 60, rejectionReason: "Sick" };
const hw = { title: "Unit 3", description: "Write 8 sentences", dueDate: when };
const quiz = { title: "Quiz 1", questions: [1, 2, 3], timeLimit: 15, dueDate: when };

// every student-facing email, called for a given language
const studentEmails = (lang) => [
  () => B.sendBookingAcceptedToStudent(student(lang), teacher, booking, "", center),
  () => B.sendBookingRejectedToStudent(student(lang), teacher, booking, "", center),
  () => B.sendBookingCreatedToStudent(student(lang), teacher, booking, "", center),
  () => B.sendClassReminder(student(lang), booking, "student", "", center),
  () => B.sendClassTimedReminder(student(lang), booking, "student", 5, "", "sunshine"),
  () => H.sendHomeworkAssigned(student(lang), teacher, hw, "", center),
  () => H.sendHomeworkDueReminder(student(lang), hw, 30, "", center),
  () => Q.sendQuizAssigned(student(lang), teacher, quiz, "", center),
  () => Q.sendQuizDueReminder(student(lang), quiz, 30, "", center),
  () => A.sendStudentInviteEmail(student(lang), "https://demo.example.com/setup?t=1", "Sunshine English"),
  () => A.sendStudentWelcomeEmail(student(lang), "Sunshine English", center),
  () => A.sendStudentForgotPasswordEmail("minh@example.com", "Minh", "tok", center, "", lang),
  () => A.sendPasswordResetEmail("minh@example.com", "Minh", "Temp123", "student", "", center, lang),
  () => A.sendNewDeviceSignInEmail({ email: "minh@example.com", name: "Minh", role: "student", center, lang, tz: "Asia/Ho_Chi_Minh" }),
  () => AC.sendAccountDeletionWarningEmail(student(lang), when, "Sunshine English"),
  () => AC.sendAccountDeletionFinalReminderEmail(student(lang), when, "Sunshine English"),
  () => R.sendProgressReport(student(lang), Buffer.from("pdf"), "weekly", when, new Date(when.getTime() + 7 * 864e5), "Sunshine English"),
  () => L.sendJoinReminderEmail({ to: "minh@example.com", student: student(lang), booking, teacherName: "Lan", started: true, byRole: "teacher", center }),
];

beforeEach(() => { sent.length = 0; });

describe("emails — Sunshine layout", () => {
  it("every student email renders in English by default", async () => {
    for (const fn of studentEmails(undefined)) await fn();
    expect(sent.length).toBe(studentEmails().length);
    for (const m of sent) {
      expect(m.html).toContain('data-em-layout="sunshine"');
      expect(m.html).toContain('lang="en"');
      expect(m.subject).toBeTruthy();
    }
  });

  it("every student email switches to Vietnamese", async () => {
    for (const fn of studentEmails("vi")) await fn();
    for (const m of sent) {
      expect(m.html).toContain('lang="vi"');
      expect(m.html).toMatch(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i);
    }
  });

  it("unknown language falls back to English", async () => {
    await B.sendBookingAcceptedToStudent(student("fr"), teacher, booking, "", center);
    expect(sent[0].html).toContain('lang="en"');
  });

  it("escapes values from the database", async () => {
    await B.sendBookingAcceptedToStudent(student("en"), teacher, booking, "", center);
    expect(sent[0].html).toContain("IELTS &lt;Speaking&gt;");
    expect(sent[0].html).not.toContain("IELTS <Speaking>");
  });

  it("shows times in the student's timezone", async () => {
    await B.sendBookingAcceptedToStudent(student("en"), teacher, booking, "", center);
    expect(sent[0].html).toContain("4:30");   // 09:30 UTC = 16:30 in Vietnam
  });

  it("teacher and admin emails stay English and render", async () => {
    await B.sendBookingRequestToTeacher(teacher, student("vi"), booking, "", center);
    await B.sendClassCompletedNotification(teacher, student("vi"), booking, "", center);
    await H.sendHomeworkSubmitted(teacher, student("vi"), hw, "", center);
    await Q.sendQuizCompleted(teacher, student("vi"), quiz, { percentage: 80, score: 8, totalQuestions: 10, timeTaken: 125 }, "", center);
    await A.sendTeacherInviteEmail(teacher, "https://x/setup", "Sunshine English");
    await A.sendAnalyticsPinCodeEmail({ email: "a@x.com", name: "Ad", code: "123456", action: "set" });
    await AC.sendTeacherAccountDeletionWarningEmail(teacher, when);
    await AE.sendOldEmailAlert({ ...center, adminEmail: "old@x.com" }, "new@x.com", "tok");
    await L.sendLessonMarkedEmails(teacher, student("vi"), booking);
    const teacherMails = sent.filter((m) => m.to !== "minh@example.com");
    expect(teacherMails.length).toBeGreaterThanOrEqual(8);
    for (const m of teacherMails) {
      expect(m.html).toContain('data-em-layout="sunshine"');
      expect(m.html).toContain('lang="en"');
    }
    // the student copy of the completed / lesson emails is in the student's language
    expect(sent.filter((m) => m.to === "minh@example.com").every((m) => m.html.includes('lang="vi"'))).toBe(true);
  });
});
