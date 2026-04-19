// Barrel re-export — all named exports are preserved so existing imports continue to work unchanged.
// To edit an email, find its category file in server/emails/:
//   core.js          — transport, sendEmail, verifyEmailConfig, getCenterBaseUrl
//   accountEmails.js — account/center deletion warnings
//   authEmails.js    — invite, welcome, forgot-password, password-reset (all roles)
//   bookingEmails.js — booking request/confirm/reject/reminder/completion
//   homeworkEmails.js — homework assigned/submitted/due-reminder
//   quizEmails.js    — quiz assigned/completed/due-reminder
//   reportEmails.js  — progress reports, new-record notifications, domain instructions

export * from '../emails/core.js';
export * from '../emails/accountEmails.js';
export * from '../emails/authEmails.js';
export * from '../emails/bookingEmails.js';
export * from '../emails/homeworkEmails.js';
export * from '../emails/quizEmails.js';
export * from '../emails/reportEmails.js';
