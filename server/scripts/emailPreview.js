// server/scripts/emailPreview.js
// Renders sample emails with the shared layout (server/emails/layout.js) into one page
// so the design can be checked in a browser — desktop and phone width side by side.
//   node server/scripts/emailPreview.js   →  email-preview/index.html
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderEmail, p, details, callout, list, esc } from "../emails/layout.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../email-preview");

const center = { name: "Sunshine English Center", branding: { logo: null } };
const baseUrl = "https://sunshine.clemify.com";
const when = new Date("2026-10-20T16:30:00");
const dateEn = when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeEn = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dateVi = when.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeVi = when.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const samples = [
  {
    name: "Class confirmed — student",
    subject: "Your class with Ms. Lan is confirmed",
    html: renderEmail({
      center, baseUrl, tone: "accent",
      preheader: `${dateEn} at ${timeEn} · IELTS Speaking Practice`,
      eyebrow: "Class confirmed",
      title: "You're all set, Minh! 🎉",
      body:
        p(`Ms. Lan Nguyen accepted your class request. Here are the details:`) +
        details([
          ["Class", "IELTS Speaking Practice"],
          ["Topic", "Describing a place you visited"],
          ["Date", dateEn],
          ["Time", `${timeEn} <span style="font-weight:600;color:#8a7262;">(GMT+7)</span>`],
          ["Duration", "60 minutes"],
          ["Teacher", "Ms. Lan Nguyen"],
        ]) +
        callout(`<strong>Tip:</strong> join 5 minutes early so your camera and microphone are ready.`, "amber"),
      cta: { label: "Open my classes", href: `${baseUrl}/student/dashboard?tab=classes` },
      after: "We'll remind you again 24 hours before the class.",
    }),
  },
  {
    name: "Class confirmed — student (Tiếng Việt)",
    subject: "Lớp học với cô Lan đã được xác nhận",
    html: renderEmail({
      center, baseUrl, tone: "accent", lang: "vi",
      preheader: `${dateVi} lúc ${timeVi} · Luyện nói IELTS`,
      eyebrow: "Đã xác nhận lớp học",
      title: "Sẵn sàng rồi, Minh ơi! 🎉",
      body:
        p(`Cô Lan Nguyễn đã chấp nhận yêu cầu lớp học của em. Thông tin lớp học:`) +
        details([
          ["Lớp học", "Luyện nói IELTS"],
          ["Chủ đề", "Miêu tả một nơi em đã đến"],
          ["Ngày", dateVi],
          ["Giờ", `${timeVi} <span style="font-weight:600;color:#8a7262;">(GMT+7)</span>`],
          ["Thời lượng", "60 phút"],
          ["Giáo viên", "Cô Lan Nguyễn"],
        ]) +
        callout(`<strong>Mẹo:</strong> vào lớp sớm 5 phút để kiểm tra camera và micro.`, "amber"),
      cta: { label: "Xem lớp học của em", href: `${baseUrl}/student/dashboard?tab=classes` },
      after: "Chúng tôi sẽ nhắc em lần nữa trước giờ học 24 tiếng.",
    }),
  },
  {
    name: "New homework — student",
    subject: "New homework: Past Simple — Unit 3",
    html: renderEmail({
      center, baseUrl, tone: "blue",
      preheader: "Due Thursday · from Ms. Lan",
      eyebrow: "New homework",
      title: "Past Simple — Unit 3",
      body:
        p(`Hi Minh, Ms. Lan has set you new homework.`) +
        details([
          ["Due", "Thursday, October 22 · 8:00 PM"],
          ["Teacher", "Ms. Lan Nguyen"],
          ["Type", "Writing · about 20 minutes"],
        ]) +
        p(`<strong style="color:#2b1d14;">Instructions</strong><br>${esc("Write 8 sentences about what you did last weekend. Use at least 5 irregular verbs.")}`),
      cta: { label: "Start homework", href: `${baseUrl}/student/dashboard?tab=homework`, tone: "blue" },
    }),
  },
  {
    name: "Reset password — student",
    subject: "Reset your password",
    html: renderEmail({
      center, baseUrl, tone: "accent",
      preheader: "This link works for 1 hour.",
      eyebrow: "Password reset",
      title: "Let's get you back in",
      body:
        p(`Hi Minh, we got a request to reset the password for your account. Tap the button to choose a new one.`) ,
      cta: { label: "Choose a new password", href: `${baseUrl}/student/reset-password/abc123` },
      after: `This link works for 1 hour. If you didn't ask for this, you can ignore this email — your password stays the same.`,
    }),
  },
  {
    name: "Account deletion warning — red",
    subject: "Your account is scheduled for deletion",
    html: renderEmail({
      center, baseUrl, tone: "red",
      preheader: "Contact your school before November 15 to keep it.",
      eyebrow: "Action needed",
      title: "Your account will be deleted on November 15",
      body:
        p(`Hi Minh, your account has been switched off and is scheduled for permanent deletion.`) +
        callout(list([
          "Your account is <strong>disabled</strong> right now.",
          "All your data will be <strong>erased</strong> on November 15.",
          "After that it <strong>can't be undone</strong>.",
        ], { color: "#991b1b" }), "red") +
        p(`If this is a mistake, contact your school before that date.`),
      cta: { label: "Contact my school", href: "mailto:admin@sunshine.example", tone: "red" },
    }),
  },
];

fs.mkdirSync(outDir, { recursive: true });
const frame = (html, w) => `<iframe title="preview" style="width:${w}px;height:860px;border:0;border-radius:18px;background:#fff;box-shadow:0 10px 30px -14px rgba(90,45,15,.35)" srcdoc="${esc(html)}"></iframe>`;
const page = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email Preview</title>
<style>body{margin:0;background:#efe6de;font-family:'Nunito',system-ui,sans-serif;color:#2b1d14}
header{padding:28px 32px 8px}h1{margin:0;font-size:24px}header p{margin:6px 0 0;color:#8a7262}
section{padding:22px 32px;border-top:1px solid #e3d5c8}h2{margin:0 0 4px;font-size:17px}.subj{margin:0 0 14px;color:#8a7262;font-size:14px}
.row{display:flex;gap:28px;align-items:flex-start;overflow-x:auto;padding-bottom:6px}.lbl{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8a7262;margin:0 0 8px}</style></head><body>
<header><h1>Email preview — Sunshine layout</h1><p>Generated by server/scripts/emailPreview.js · left: desktop inbox (640px) · right: phone (390px)</p></header>
${samples.map((s) => `<section><h2>${esc(s.name)}</h2><p class="subj">Subject: ${esc(s.subject)}</p><div class="row"><div><p class="lbl">Desktop</p>${frame(s.html, 640)}</div><div><p class="lbl">Phone</p>${frame(s.html, 390)}</div></div></section>`).join("")}
</body></html>`;
fs.writeFileSync(path.join(outDir, "index.html"), page);
for (const [i, s] of samples.entries()) fs.writeFileSync(path.join(outDir, `${i + 1}.html`), s.html);
console.log(`Wrote ${samples.length} emails → ${path.join(outDir, "index.html")}`);
