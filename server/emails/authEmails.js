// Account & sign-in emails — invites, welcomes, password resets, security notices.
// Built on the shared layout (layout.js). Student emails follow the student's
// emailLanguage (i18n.js); everyone else gets English.
import { config } from "../config/config.js";
import { sendEmail, getCenterBaseUrl } from "./core.js";
import { renderEmail, p, details, callout, list, code, esc, C } from "./layout.js";
import { langOf, brandOf, pick, fmtDate, fmtTime } from "./i18n.js";

/** Small "button not working? copy this link" line under a button */
const linkFallback = (url, lang = "en") => p(
  `${lang === "vi" ? "Nút không hoạt động? Sao chép liên kết này vào trình duyệt:" : "Button not working? Copy this link into your browser:"}<br>` +
  `<a href="${esc(url)}" style="color:${C.accent};word-break:break-all;">${esc(url)}</a>`,
  { size: 12, color: C.muted, mt: 18, mb: 0, align: "center" });

/** Reset link for a role, keeping the ?center= param the old emails used */
const resetUrlFor = (rolePath, resetToken, center) => {
  const { baseUrl, needsSlug } = getCenterBaseUrl(center);
  const slug = typeof center === "string" ? center : center?.slug;
  return `${baseUrl}/${rolePath}/reset-password/${resetToken}${needsSlug && slug ? `?center=${slug}` : ""}`;
};

// ── Legacy: account created with a password ─────────────────────────────────────
export const sendWelcomeEmail = async (email, name, password, centerName = "") => {
  const b = brandOf(null, centerName);
  return sendEmail({
    centerName: b.centerName,
    to: email,
    subject: `Welcome to ${b.centerName}!`,
    html: renderEmail({
      ...b, baseUrl: config.frontendUrl,
      preheader: "Your account is ready — here are your sign-in details.",
      eyebrow: "Welcome", title: `Welcome, ${name}!`,
      body:
        p("Your account has been created. Sign in with these details:") +
        details([["Email", esc(email)], ["Password", `<span style="font-family:Menlo,Consolas,monospace;">${esc(password)}</span>`]]) +
        callout("Please change your password after your first sign-in.", "amber"),
      cta: { label: "Sign in", href: `${config.frontendUrl}/login` },
    }),
  });
};

// ── Admin reset a user's password to a new one ──────────────────────────────────
const ADMIN_RESET = {
  en: {
    subject: "Your password has been reset", eyebrow: "Password reset", title: (n) => `Hi ${n}, your password was reset`,
    intro: "Your school's administrator set a new password for your account:", label: "New password",
    change: "Please sign in and change it to one only you know.", cta: "Sign in",
  },
  vi: {
    subject: "Mật khẩu của em đã được đặt lại", eyebrow: "Đặt lại mật khẩu", title: (n) => `Chào ${n}, mật khẩu của em đã được đặt lại`,
    intro: "Quản trị viên của trung tâm đã đặt mật khẩu mới cho tài khoản của em:", label: "Mật khẩu mới",
    change: "Hãy đăng nhập và đổi sang mật khẩu chỉ em biết.", cta: "Đăng nhập",
  },
};
/** `lang` applies to students only (pass student.emailLanguage). */
export const sendPasswordResetEmail = async (email, name, newPassword, role = "teacher", centerName = "", center = null, lang = "en") => {
  const b = brandOf(center, centerName);
  const l = role === "student" ? langOf({ emailLanguage: lang }) : "en";
  const s = pick(ADMIN_RESET, l);
  const loginPath = role === "student" ? "/student/login" : role === "admin" ? "/admin/login" : "/teacher/login";
  return sendEmail({
    centerName: b.centerName,
    to: email,
    subject: s.subject,
    html: renderEmail({
      ...b, lang: l,
      preheader: s.change,
      eyebrow: s.eyebrow, title: s.title(name),
      body:
        p(s.intro) +
        details([[s.label, `<span style="font-family:Menlo,Consolas,monospace;font-size:16px;">${esc(newPassword)}</span>`]]) +
        callout(s.change, "amber"),
      cta: { label: s.cta, href: `${b.baseUrl}${loginPath}` },
    }),
  });
};

// ── Forgot password (self-service reset links) ───────────────────────────────────
const FORGOT = {
  en: {
    subject: "Reset your password", eyebrow: "Password reset", title: "Let's get you back in",
    intro: (n) => `Hi ${n}, we got a request to reset your password. Tap the button to choose a new one.`,
    cta: "Choose a new password",
    after: "This link works for 1 hour. Didn't ask for this? Ignore this email — your password stays the same.",
  },
  vi: {
    subject: "Đặt lại mật khẩu của em", eyebrow: "Đặt lại mật khẩu", title: "Cùng lấy lại tài khoản nhé",
    intro: (n) => `Chào ${n}, chúng tôi nhận được yêu cầu đặt lại mật khẩu của em. Bấm nút bên dưới để chọn mật khẩu mới.`,
    cta: "Chọn mật khẩu mới",
    after: "Liên kết có hiệu lực trong 1 giờ. Nếu em không yêu cầu, hãy bỏ qua email này — mật khẩu sẽ không thay đổi.",
  },
};
const forgotEmail = ({ to, name, url, center, centerName, lang = "en", subject }) => {
  const b = brandOf(center, centerName);
  const s = pick(FORGOT, lang);
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: subject || s.subject,
    html: renderEmail({
      ...b, lang,
      preheader: s.after,
      eyebrow: s.eyebrow, title: s.title,
      body: p(s.intro(esc(name || ""))),
      cta: { label: s.cta, href: url },
      after: s.after, extra: linkFallback(url, lang),
    }),
  });
};

/** `lang`: the student's emailLanguage */
export const sendStudentForgotPasswordEmail = async (email, name, resetToken, center = null, centerName = "", lang = "en") =>
  forgotEmail({ to: email, name, url: resetUrlFor("student", resetToken, center), center, centerName, lang: langOf({ emailLanguage: lang }) });

export const sendAdminForgotPasswordEmail = async (email, name, resetToken, center = null, centerName = "") =>
  forgotEmail({ to: email, name: name || "Admin", url: resetUrlFor("admin", resetToken, center), center, centerName, subject: "Admin password reset" });

export const sendForgotPasswordEmail = async (email, name, resetToken, center = null, centerName = "") =>
  forgotEmail({ to: email, name, url: resetUrlFor("teacher", resetToken, center), center, centerName });

export const sendSubAdminForgotPasswordEmail = async (subAdmin, resetToken, center = null, centerName = "") =>
  forgotEmail({ to: subAdmin.email, name: subAdmin.firstName, url: resetUrlFor("sub-admin", resetToken, center), center, centerName, subject: "Sub-admin password reset" });

// ── Invites (set-up links) ───────────────────────────────────────────────────────
export const sendSubAdminInviteEmail = async (subAdmin, setupUrl, createdBy, centerName = "") => {
  const b = brandOf(null, centerName);
  const adminName = createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : "The main administrator";
  return sendEmail({
    centerName: b.centerName,
    to: subAdmin.email,
    subject: `You're invited to join ${b.centerName} as a sub-admin`,
    html: renderEmail({
      ...b, baseUrl: null,
      preheader: `${adminName} invited you — set up your account within 48 hours.`,
      eyebrow: "You're invited", title: `Welcome to the team, ${subAdmin.firstName}!`,
      body:
        p(`<strong>${esc(adminName)}</strong> has invited you to help run <strong>${esc(b.centerName)}</strong> as a sub-admin. You'll manage your assigned teachers and their students.`) +
        details([["Your email", esc(subAdmin.email)], ["Role", "Sub-admin"], ["Invited by", esc(adminName)]]),
      cta: { label: "Set up my account", href: setupUrl },
      after: "This invitation expires in 48 hours. Didn't expect it? You can ignore this email.", extra: linkFallback(setupUrl),
    }),
  });
};

export const sendTeacherInviteEmail = async (teacher, setupUrl, centerName = "") => {
  const b = brandOf(null, centerName);
  return sendEmail({
    centerName: b.centerName,
    to: teacher.email,
    subject: `You're invited to teach at ${b.centerName} 🎓`,
    html: renderEmail({
      ...b, baseUrl: null,
      preheader: "Set up your teacher account within 48 hours.",
      eyebrow: "Teacher invitation", title: `Welcome to the team, ${teacher.firstName}!`,
      body:
        p(`You've been invited to join <strong>${esc(b.centerName)}</strong> as a teacher. Manage your classes, connect with students and track your earnings — all in one place.`) +
        details([
          ["Your email", esc(teacher.email)],
          ["Region", teacher.continent && esc(teacher.continent)],
          ["Rate per class", `$${esc(teacher.ratePerClass || 0)}`],
        ]),
      cta: { label: "Set up my teacher account", href: setupUrl },
      after: "This invitation expires in 48 hours. Didn't expect it? You can ignore this email.", extra: linkFallback(setupUrl),
    }),
  });
};

const STUDENT_INVITE = {
  en: {
    subject: (c) => `You're invited to ${c} — set up your account`, eyebrow: "You're invited",
    title: (n) => `Welcome, ${n}! 🎓`,
    intro: (c) => `Your account at <strong>${c}</strong> is ready. Set your password to start learning.`,
    labels: ["Your email", "Classes", "Age"], classes: (n) => `${n} classes`, years: (n) => `${n} years`,
    perks: ["Join live classes", "Chat with your teacher", "Earn badges and track your progress"],
    cta: "Set up my account", after: "This link expires in 48 hours. Didn't expect this? You can ignore it.",
  },
  vi: {
    subject: (c) => `Em được mời tham gia ${c} — thiết lập tài khoản`, eyebrow: "Lời mời tham gia",
    title: (n) => `Chào mừng ${n}! 🎓`,
    intro: (c) => `Tài khoản của em tại <strong>${c}</strong> đã sẵn sàng. Hãy đặt mật khẩu để bắt đầu học.`,
    labels: ["Email của em", "Số buổi học", "Tuổi"], classes: (n) => `${n} buổi`, years: (n) => `${n} tuổi`,
    perks: ["Tham gia lớp học trực tuyến", "Trò chuyện với giáo viên", "Nhận huy hiệu và theo dõi tiến bộ"],
    cta: "Thiết lập tài khoản", after: "Liên kết hết hạn sau 48 giờ. Nếu em không mong đợi email này, hãy bỏ qua.",
  },
};
export const sendStudentInviteEmail = async (student, setupUrl, centerName = "") => {
  const b = brandOf(null, centerName);
  const lang = langOf(student), s = pick(STUDENT_INVITE, lang), L = s.labels;
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(b.centerName),
    html: renderEmail({
      ...b, baseUrl: null, lang,
      preheader: s.after,
      eyebrow: s.eyebrow, title: s.title(student.firstName),
      body:
        p(s.intro(esc(b.centerName))) +
        details([
          [L[0], esc(student.email)],
          [L[1], student.classCredits != null && s.classes(student.classCredits)],
          [L[2], student.age && s.years(student.age)],
        ]) +
        list(s.perks),
      cta: { label: s.cta, href: setupUrl },
      after: s.after, extra: linkFallback(setupUrl, lang),
    }),
  });
};

export const sendParentInviteEmail = async (parent, setupUrl, centerName = "") => {
  const b = brandOf(null, centerName);
  return sendEmail({
    centerName: b.centerName,
    to: parent.email,
    subject: `You're invited to follow your child's progress at ${b.centerName}`,
    html: renderEmail({
      ...b, baseUrl: null,
      preheader: "Set up your parent account within 48 hours.",
      eyebrow: "Parent portal", title: `Hi ${parent.firstName}, you're invited!`,
      body:
        p(`<strong>${esc(b.centerName)}</strong> has created a parent account for you, so you can follow your child's learning as it happens:`) +
        list(["Class schedule and attendance", "Homework and grades", "Certificates and progress"]),
      cta: { label: "Set up my account", href: setupUrl },
      after: "This invite link expires in 48 hours.", extra: linkFallback(setupUrl),
    }),
  });
};

// ── Welcome (after set-up) ───────────────────────────────────────────────────────
export const sendSubAdminWelcomeEmail = async (subAdmin, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  return sendEmail({
    centerName: b.centerName,
    to: subAdmin.email,
    subject: `Welcome aboard, ${subAdmin.firstName}! Your account is ready 🎉`,
    html: renderEmail({
      ...b, tone: "green",
      preheader: "Your sub-admin account is active.",
      eyebrow: "Account ready", title: `Welcome aboard, ${subAdmin.firstName}! 🎉`,
      body:
        p(`Your sub-admin account at <strong>${esc(b.centerName)}</strong> is active. From your dashboard you can:`) +
        list(["Manage your teachers", "View their students", "Send messages", "Track bookings"]) +
        p(`Sign in with <strong>${esc(subAdmin.email)}</strong> and the password you just created.`),
      cta: { label: "Go to my dashboard", href: `${b.baseUrl}/sub-admin/login`, tone: "green" },
      after: "Questions? Contact the administrator who set up your account.",
    }),
  });
};

export const sendTeacherWelcomeEmail = async (teacher, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  return sendEmail({
    centerName: b.centerName,
    to: teacher.email,
    subject: `Your teacher account is ready, ${teacher.firstName}! 🎉`,
    html: renderEmail({
      ...b, tone: "green",
      preheader: "Your teacher account is active.",
      eyebrow: "Account ready", title: `You're all set, ${teacher.firstName}! 🎉`,
      body:
        p(`Your teacher account at <strong>${esc(b.centerName)}</strong> is active. From your dashboard you can:`) +
        list(["Schedule classes", "Manage your students", "Teach in the video classroom", "Track your earnings"]) +
        p(`Sign in with <strong>${esc(teacher.email)}</strong> and the password you just created.`),
      cta: { label: "Go to my dashboard", href: `${b.baseUrl}/teacher/login`, tone: "green" },
      after: "Questions? Contact your administrator.",
    }),
  });
};

const STUDENT_WELCOME = {
  en: {
    subject: (c) => `Welcome to ${c} — your account is ready! 🎉`, eyebrow: "Account ready",
    title: (n) => `You're all set, ${n}! 🎉`,
    intro: (c) => `Your <strong>${c}</strong> account is active. Here's how to start:`,
    steps: ["Sign in with your email and the password you just created", "Check your dashboard for upcoming classes", "Join a class and start learning 🚀", "Earn badges as you complete classes"],
    cta: "Go to my dashboard",
  },
  vi: {
    subject: (c) => `Chào mừng em đến với ${c} — tài khoản đã sẵn sàng! 🎉`, eyebrow: "Tài khoản đã sẵn sàng",
    title: (n) => `Sẵn sàng rồi, ${n}! 🎉`,
    intro: (c) => `Tài khoản <strong>${c}</strong> của em đã được kích hoạt. Bắt đầu như sau:`,
    steps: ["Đăng nhập bằng email và mật khẩu em vừa tạo", "Xem các lớp học sắp tới trên trang của em", "Tham gia lớp học và bắt đầu học 🚀", "Nhận huy hiệu khi hoàn thành các lớp học"],
    cta: "Vào trang của em",
  },
};
export const sendStudentWelcomeEmail = async (student, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(STUDENT_WELCOME, lang);
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(b.centerName),
    html: renderEmail({
      ...b, lang, tone: "green",
      preheader: s.steps[1],
      eyebrow: s.eyebrow, title: s.title(student.firstName),
      body: p(s.intro(esc(b.centerName))) + list(s.steps.map((x, i) => `<strong>${i + 1}.</strong> ${x}`)).replace("padding-left:20px", "padding-left:0;list-style:none"),
      cta: { label: s.cta, href: `${b.baseUrl}/student/login`, tone: "green" },
    }),
  });
};

// ── New sign-in on a new device ──────────────────────────────────────────────────
const LOGIN_PATHS = {
  admin: "/admin/login", teacher: "/teacher/login", student: "/student/login",
  "sub-admin": "/sub-admin/login", parent: "/parent/login",
};
const NEW_DEVICE = {
  en: {
    subject: (c) => `New sign-in to your ${c} account`, eyebrow: "Security notice", title: "New sign-in on a new device",
    intro: (n, c) => `Hi ${n}, your ${c} account was just used on a device it hasn't been used on before.`,
    labels: ["Device", "IP address", "Time"], unknown: "Unknown browser", none: "Not available",
    ok: "<strong>Was this you?</strong> Then you don't need to do anything.",
    notYou: "<strong>Not you?</strong> Sign in, open <em>Your devices</em>, log out the device you don't recognise, then change your password straight away.",
    cta: "Go to sign in", after: "You get this email whenever your account is used on a new device.",
  },
  vi: {
    subject: (c) => `Đăng nhập mới vào tài khoản ${c} của em`, eyebrow: "Thông báo bảo mật", title: "Đăng nhập trên thiết bị mới",
    intro: (n, c) => `Chào ${n}, tài khoản ${c} của em vừa được đăng nhập trên một thiết bị chưa từng dùng trước đây.`,
    labels: ["Thiết bị", "Địa chỉ IP", "Thời gian"], unknown: "Trình duyệt không xác định", none: "Không có",
    ok: "<strong>Đó là em?</strong> Vậy em không cần làm gì cả.",
    notYou: "<strong>Không phải em?</strong> Hãy đăng nhập, mở <em>Thiết bị của bạn</em>, đăng xuất thiết bị lạ, rồi đổi mật khẩu ngay.",
    cta: "Đăng nhập", after: "Em nhận email này mỗi khi tài khoản được dùng trên thiết bị mới.",
  },
};
/** `lang` applies to students only (pass user.emailLanguage); `tz` = the user's timezone */
export const sendNewDeviceSignInEmail = async ({ email, name, role, center, centerName = "", device = {}, ipAddress, when = new Date(), lang = "en", tz }) => {
  const b = brandOf(center, centerName);
  const l = role === "student" ? langOf({ emailLanguage: lang }) : "en";
  const s = pick(NEW_DEVICE, l);
  const what = [device.browser, device.os].filter(Boolean).join(" · ") || s.unknown;
  const ip = ipAddress && ipAddress !== "Unknown" ? ipAddress : s.none;
  return sendEmail({
    centerName: b.centerName,
    to: email,
    subject: s.subject(b.centerName),
    html: renderEmail({
      ...b, lang: l, tone: "amber",
      preheader: `${what} · ${fmtTime(when, l, tz)}`,
      eyebrow: s.eyebrow, title: s.title,
      body:
        p(s.intro(esc(name || ""), esc(b.centerName))) +
        details([
          [s.labels[0], esc(what)],
          [s.labels[1], esc(ip)],
          [s.labels[2], `${fmtDate(when, l, tz)} · ${fmtTime(when, l, tz)}${tz ? "" : " UTC"}`],
        ]) +
        p(s.ok) +
        callout(s.notYou, "amber"),
      cta: { label: s.cta, href: `${b.baseUrl}${LOGIN_PATHS[role] || "/"}`, tone: "amber" },
      after: s.after,
    }),
  });
};

// ── Analytics PIN (admins, English) ─────────────────────────────────────────────
/** 6-digit code that must be entered to set, change, reset or remove the PIN */
export const sendAnalyticsPinCodeEmail = async ({ email, name, code: pin, action, centerName = "", minutes = 15 }) => {
  const b = brandOf(null, centerName);
  const what = action === "remove" ? "remove your analytics PIN" : "set a new analytics PIN";
  return sendEmail({
    centerName: b.centerName,
    to: email,
    subject: `Your code to ${action === "remove" ? "remove" : "change"} the analytics PIN`,
    html: renderEmail({
      ...b, baseUrl: null,
      preheader: `Your code expires in ${minutes} minutes.`,
      eyebrow: "Confirm PIN change", title: "Here's your code",
      body:
        p(`Hi ${esc(name || "there")}, someone signed in to your admin account asked to <strong>${what}</strong>. Enter this code to confirm:`) +
        code(pin) +
        p(`The code expires in ${minutes} minutes.`, { size: 13, color: C.muted, align: "center" }) +
        callout("<strong>Didn't ask for this?</strong> Someone may know your password. Don't share this code — change your password and log out your other devices straight away.", "amber"),
    }),
  });
};

/** Alert after the PIN was set, changed or removed */
export const sendAnalyticsPinChangedEmail = async ({ email, name, action, hadPin, centerName = "", when = new Date() }) => {
  const b = brandOf(null, centerName);
  const what = action === "remove" ? "removed" : hadPin ? "changed" : "set";
  return sendEmail({
    centerName: b.centerName,
    to: email,
    subject: `Your analytics PIN was ${what}`,
    html: renderEmail({
      ...b, baseUrl: null, tone: "amber",
      preheader: "If this was you, you don't need to do anything.",
      eyebrow: "Security notice", title: `Analytics PIN ${what}`,
      body:
        p(`Hi ${esc(name || "there")}, the analytics PIN on your admin account was <strong>${what}</strong> on ${esc(new Date(when).toUTCString())}.`) +
        p("If this was you, you don't need to do anything.") +
        callout("<strong>Not you?</strong> Change your password now and log out all other devices.", "red"),
    }),
  });
};
