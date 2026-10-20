// server/utils/familyEmailPrefs.js
// Who gets the automatic emails to managed students' families: the class video link
// (utils/recordingLinks.js), the teacher's class summary (utils/classSummaryEmails.js),
// the parent attendance check and homework / quiz links (utils/familyLinkEmails.js).
//
//   • Center switch (CenterSettings) + a per-student setting (Student.<kind>).
//   • Flipping the center switch sets EVERY managed student to the same value — off means
//     everyone is off until an admin turns individual students back on (and vice versa).
//   • A student with no setting of their own (e.g. added later) follows the center switch.
//   • Only managed students with a notification address are ever emailed automatically.
//   Manual buttons ("Email now", "Email to family") send regardless of these switches.
import { studentSchema } from "../schemas/studentSchema.js";
import { centerSettingsSchema, CENTER_SETTING_DEFAULTS } from "../schemas/centerSettingsSchema.js";

export const FAMILY_EMAIL_KINDS = ["recordingLinkEmails", "classSummaryEmails", "parentCheckEmails", "shareLinkEmails"];

const getStudent        = (db) => db.models.Student        || db.model("Student",        studentSchema);
export const getCenterSettings = (db) => db.models.CenterSettings || db.model("CenterSettings", centerSettingsSchema);

export async function loadCenterSettings(db) {
  const doc = await getCenterSettings(db).findOne({ key: "main" }).lean();
  return { ...CENTER_SETTING_DEFAULTS, ...(doc || {}) };
}

/** Is this kind of email on for this student? (their own setting, else the center's) */
export const prefOn = (student, settings, kind) =>
  (typeof student?.[kind] === "boolean" ? student[kind] : settings[kind] !== false);

/** Mongo filter: students for whom `kind` is on. */
export const prefOnFilter = (settings, kind) => (settings[kind] !== false
  ? { [kind]: { $ne: false } }
  : { [kind]: true });

/** Managed students who could be emailed automatically, and how many have `kind` on. */
export async function prefCounts(db, settings, kind) {
  const Student = getStudent(db);
  const base = { isManaged: true, notifyEmail: { $nin: [null, ""] } };
  const [withEmail, on] = await Promise.all([
    Student.countDocuments(base),
    Student.countDocuments({ ...base, ...prefOnFilter(settings, kind) }),
  ]);
  return { withEmail, on };
}

/** Flip a center switch: saves it and sets every managed student to the same value. */
export async function setCenterPref(db, kind, value) {
  if (!FAMILY_EMAIL_KINDS.includes(kind)) throw new Error(`Unknown setting ${kind}`);
  await getCenterSettings(db).updateOne({ key: "main" }, { $set: { [kind]: value } }, { upsert: true });
  const r = await getStudent(db).updateMany({ isManaged: true }, { $set: { [kind]: value } });
  return r.modifiedCount;
}
