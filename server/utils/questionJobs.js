// server/utils/questionJobs.js
// Background work for "questions from book pages", per center, following the
// centerJobs pattern (and shown under Background jobs in App Health):
//   • every 10 s: run the oldest queued AI job — one at a time on this server
//   • every hour: delete uploaded pages older than 30 days (and abandoned uploads)
// A finished job becomes a DRAFT question set; the center's AI credits are
// charged by what the AI actually used; the teacher gets a push notification.
import { questionJobSchema } from "../schemas/questionJobSchema.js";
import { questionSourceSchema } from "../schemas/questionSourceSchema.js";
import { questionSetSchema } from "../schemas/questionSetSchema.js";
import { generateQuestions } from "./questionAi.js";
import { readSource, removeSourceFile } from "./questionSources.js";
import { chargeAiCredits, creditsForUsage } from "./aiCredits.js";
import { pushTeacher } from "./notifyPush.js";
import { trackJob } from "./monitor.js";
import logger from "./logger.js";

const getJob    = (db) => db.models.QuestionJob    || db.model("QuestionJob", questionJobSchema);
const getSource = (db) => db.models.QuestionSource || db.model("QuestionSource", questionSourceSchema);
const getSet    = (db) => db.models.QuestionSet    || db.model("QuestionSet", questionSetSchema);

const TICK_MS = 10 * 1000;
const SWEEP_MS = 60 * 60 * 1000;
const STUCK_MS = 5 * 60 * 1000;   // a job "running" this long was interrupted (restart) — try again
const MIN_QUESTIONS = 4;

let busy = false; // concurrency 1 per server, across all centers

/**
 * Run the oldest queued job of this center, if the server isn't busy.
 * @param deps  { ai } — tests pass a fake AI client
 * @returns the finished job, or null
 */
export async function runNextJob(db, center, deps = {}) {
  if (busy) return null;
  busy = true;
  try {
    const Job = getJob(db);
    // jobs left "running" by a restart go back in the queue (or fail after 2 tries)
    await Job.updateMany({ status: "running", startedAt: { $lt: new Date(Date.now() - STUCK_MS) }, attempts: { $lt: 2 } }, { $set: { status: "queued" } });
    await Job.updateMany({ status: "running", startedAt: { $lt: new Date(Date.now() - STUCK_MS) }, attempts: { $gte: 2 } }, { $set: { status: "failed", error: "The job was interrupted. Please try again.", finishedAt: new Date() } });

    const job = await Job.findOneAndUpdate(
      { status: "queued" },
      { $set: { status: "running", startedAt: new Date() }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!job) return null;
    return await runJob(db, center, job, deps);
  } finally {
    busy = false;
  }
}

async function runJob(db, center, job, { ai } = {}) {
  const Job = getJob(db);
  const fail = async (message, usage) => {
    let creditsUsed = 0;
    if (usage && (usage.input_tokens || usage.output_tokens)) creditsUsed = await chargeAiCredits(center.slug, creditsForUsage(usage), `Word Squad AI (failed): ${job.title}`);
    await Job.updateOne({ _id: job._id }, { $set: { status: "failed", error: message, finishedAt: new Date(), creditsUsed, ...(usage ? { usage } : {}) } });
    logger.warn("Word Squad AI job failed", { center: center.slug, job: String(job._id), error: message });
    return Job.findById(job._id).lean();
  };

  const sources = await getSource(db).find({ _id: { $in: job.sourceIds }, status: "ready" }).lean();
  if (!sources.length || sources.length !== job.sourceIds.length) return fail("Some pages were deleted before the questions were made. Upload them again.");
  let files;
  try {
    files = [];
    let totalBytes = 0;
    for (const source of sources) {
      // Bound the whole job too: ten individually valid PDFs must not cause
      // ten concurrent large downloads followed by another base64 allocation.
      if (totalBytes + source.size > 30 * 1024 * 1024) throw new Error('Too many source bytes');
      const buffer = await readSource(source);
      totalBytes += buffer.length;
      files.push({ mime: source.mime, buffer });
    }
  } catch {
    return fail("Could not read the uploaded pages. Upload them again.");
  }

  let result;
  try {
    result = await generateQuestions({ files, level: job.level, focus: job.focus, wantedCount: job.wantedCount }, ai);
  } catch (err) {
    return fail("The AI couldn't read these pages right now. Please try again in a few minutes.", err?.usage);
  }
  const creditsUsed = await chargeAiCredits(center.slug, creditsForUsage(result.usage), `Word Squad AI: ${job.title}`);
  if (result.questions.length < MIN_QUESTIONS) {
    await Job.updateOne({ _id: job._id }, { $set: { creditsUsed, usage: result.usage } });
    return fail(`Only found ${result.questions.length} good questions in these pages. Try clearer photos or more pages.`);
  }

  const set = await getSet(db).create({
    title: job.title, level: job.level, status: "draft", source: "ai_upload",
    sourceFiles: sources.map((s) => s.key), jobId: job._id, createdBy: job.createdBy,
    questions: result.questions,
  });
  await Job.updateOne({ _id: job._id }, {
    $set: { status: "done", setId: set._id, made: result.questions.length, creditsUsed, usage: result.usage, finishedAt: new Date(), error: "" },
  });
  if (job.createdBy?.role === "teacher" && job.createdBy.id) {
    pushTeacher(db, job.createdBy.id, "Your Word Squad questions are ready", `${result.questions.length} questions for “${job.title}” — review and publish them.`, { tag: `ws-job-${job._id}`, tab: "games" })
      .catch(() => {});
  }
  return Job.findById(job._id).lean();
}

/** Delete pages past their 30 days, and uploads that never finished (after a day). */
export async function sweepExpiredSources(db) {
  const Source = getSource(db);
  const old = await Source.find({
    $or: [{ expiresAt: { $lt: new Date() } }, { status: "pending", createdAt: { $lt: new Date(Date.now() - 86400000) } }],
  }).limit(500).lean();
  for (const s of old) await removeSourceFile(s);
  if (old.length) await Source.deleteMany({ _id: { $in: old.map((s) => s._id) } });
  return old.length;
}

/** Start this center's timers (registered in centerJobs.startCenterJobs) */
export function startQuestionJobScheduler(db, center) {
  const slug = center?.slug || db.name;
  const tick = trackJob("Word Squad AI questions", slug, TICK_MS, () => runNextJob(db, { ...center, slug }));
  const sweep = trackJob("Word Squad page cleanup", slug, SWEEP_MS, () => sweepExpiredSources(db));
  return [setInterval(tick, TICK_MS), setInterval(sweep, SWEEP_MS), setTimeout(sweep, 60 * 1000)];
}
