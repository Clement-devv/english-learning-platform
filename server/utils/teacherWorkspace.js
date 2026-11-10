import jwt from 'jsonwebtoken';
import TeacherWorkspace from '../models/master/TeacherWorkspace.js';
import { getDb } from '../config/dbManager.js';
import { getCenterSecret } from './jwtUtils.js';
import { JWT_VERIFY_OPTIONS } from '../config/config.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { studentSchema } from '../schemas/studentSchema.js';
import { teacherModeModels } from '../schemas/teacherModeSchemas.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { isTokenBlacklisted } from '../middleware/authMiddleware.js';

export const workspaceContext = w => ({
  _id: w._id, slug: w.key, centerName: w.name, kind: 'teacher-workspace',
  timezone: w.timezone, plan: 'basic', branding: {}, features: {},
  maxStudents: 1000, maxTeachers: 1,
});
export async function attachWorkspace(req, workspace) {
  req.teacherWorkspace = workspace;
  req.center = workspaceContext(workspace);
  req.db = await getDb(workspace.key);
  req.db.models.Teacher || req.db.model('Teacher', teacherSchema);
  req.db.models.Student || req.db.model('Student', studentSchema);
}
export async function teacherWorkspaceAuth(req, res, next) {
  try {
    const refresh = req.path === '/auth/refresh' && req.method === 'POST';
    const token = refresh ? req.body?.expiredToken : req.headers.authorization?.split(' ')[1];
    const hint = jwt.decode(token || '');
    if (hint?.realm !== 'teacher-mode' || !/^tw-[a-f\d]{24}$/.test(hint.centerId || '')) throw new Error('invalid');
    const claims = jwt.verify(token, getCenterSecret(hint.centerId), { ...JWT_VERIFY_OPTIONS, ignoreExpiration: refresh });
    if (claims.role !== 'teacher' || await isTokenBlacklisted(token)) throw new Error('invalid');
    if (claims.teacherInspection && (refresh || !['GET', 'HEAD', 'OPTIONS'].includes(req.method))) return res.status(403).json({ success: false, message: 'This Super Admin viewing session is read-only.' });
    const workspace = await TeacherWorkspace.findOne({ key: claims.centerId, ownerId: claims.id, status: 'active' });
    if (!workspace) throw new Error('inactive');
    await attachWorkspace(req, workspace);
    const teacher = await req.db.models.Teacher.findById(claims.id).select('active timezone');
    if (!teacher?.active) throw new Error('inactive');
    if (teacher.timezone) req.center.timezone = teacher.timezone;
    req.user = claims;
    if (req.query.managedCenterId) {
      const id = String(req.query.managedCenterId);
      if (!/^[a-f\d]{24}$/.test(id) || !await teacherModeModels(req.db).ManagedCenter.exists({ _id: id })) return res.status(400).json({ success: false, message: 'Managed center not found.' });
      req.modeStudentIds = await req.db.models.Student.distinct('_id', { managedCenterId: id });
      const G = req.db.models.GroupClass || req.db.model('GroupClass', groupClassSchema);
      req.modeGroupIds = await G.distinct('_id', { managedCenterId: id });
      req.modeStudentFilter = { $or: [{ studentId: { $in: req.modeStudentIds } }, { groupClassId: { $in: req.modeGroupIds } }] };
      const allowed = new Set(req.modeStudentIds.map(String));
      const inputs = [req.body?.studentId, ...(Array.isArray(req.body?.studentIds) ? req.body.studentIds : [])].filter(Boolean);
      if (inputs.some(value => !allowed.has(String(value)))) return res.status(400).json({ success: false, message: 'Choose a student from this managed center.' });
    }
    next();
  } catch { res.status(401).json({ success: false, message: 'Please sign in to Teacher Mode.' }); }
}

// Public workspace id is only a routing hint, never authorization. Restrict it
// to existing opaque-token activity routes; those handlers still validate tokens.
export async function publicTeacherWorkspace(req) {
  const key = req.query.workspace || req.query.c;
  if (typeof key !== 'string' || !/^tw-[a-f\d]{24}$/.test(key)) return false;
  if (!/^\/api\/v1\/(homework|quiz|games|parent-checks|recording-links)\/link\/[A-Za-z0-9_-]{43}(\/|\?|$)/.test(req.originalUrl)) return false;
  const w = await TeacherWorkspace.findOne({ key, status: 'active' });
  if (!w) return false;
  await attachWorkspace(req, w);
  return true;
}
