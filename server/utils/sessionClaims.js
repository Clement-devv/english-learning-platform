// server/utils/sessionClaims.js
// Builds the JWT payload for a center user. Used by every login route AND by
// /auth/refresh, so a renewed token carries exactly the claims a fresh login
// would (e.g. a sub-admin's current teacher scope and permissions).
import jwt from "jsonwebtoken";
import { config, JWT_STANDARD_CLAIMS } from "../config/config.js";
import { getCenterSecret } from "./jwtUtils.js";
import { getUserModelForRole, normaliseRole } from "./roleModels.js";

/** Role-specific claims merged into the JWT */
export async function buildRoleClaims(role, user, db) {
  role = normaliseRole(role);
  if (role === "admin") return { username: user.username };
  if (role === "sub-admin") {
    let teacherScope = (user.assignedTeachers || []).map(t => String(t?._id || t));
    if (user.assignmentType === "region" && user.region) {
      const Teacher  = getUserModelForRole(db, "teacher");
      const teachers = await Teacher.find({ continent: user.region }).select("_id").lean();
      teacherScope   = teachers.map(t => String(t._id));
    }
    return {
      assignmentType: user.assignmentType,
      region:         user.region,
      teacherScope,
      permissions:    user.permissions,
    };
  }
  return {};
}

/**
 * Sign an access token for a center user.
 * @param {object} p
 * @param {string} p.role
 * @param {object} p.user
 * @param {string} p.centerSlug
 * @param {string} p.sid          device session id (see sessionManager.startSession)
 * @param {object} [p.extra]      role claims from buildRoleClaims
 */
export function signAccessToken({ role, user, centerSlug, sid, extra = {} }) {
  return jwt.sign(
    {
      ...JWT_STANDARD_CLAIMS,
      id:       user._id,
      email:    user.email,
      role:     normaliseRole(role),
      centerId: centerSlug,
      sid,
      ...extra,
    },
    getCenterSecret(centerSlug),
    { expiresIn: config.jwtExpiry },
  );
}
