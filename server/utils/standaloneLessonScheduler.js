import TeacherWorkspace from '../models/master/TeacherWorkspace.js';
import { getDb } from '../config/dbManager.js';
import { sweepUnattendedStandaloneLessons } from '../services/standaloneLessonService.js';
import logger from './logger.js';
let timer, running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    for await (const w of TeacherWorkspace.find({ status: 'active' }).select('key').cursor()) {
      if (!timer) break;
      try { await sweepUnattendedStandaloneLessons(await getDb(w.key)); }
      catch (error) { logger.error('Standalone unattended-class sweep failed', { workspace: w.key, error: error.message }); }
    }
  } finally { running = false; }
}
export function startStandaloneLessonScheduler() {
  if (timer) return;
  const run = () => tick().catch(error => logger.error('Standalone class scheduler failed', { error: error.message }));
  timer = setInterval(run, 30000); run();
}
export function stopStandaloneLessonScheduler() { clearInterval(timer); timer = null; }
