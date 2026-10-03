// server/utils/roleModels.js
// One place that maps a center-scoped role to its Mongoose model, so session,
// push and auth code handles every role (including sub-admin and parent) the
// same way instead of each file keeping its own partial switch.
import { adminSchema }    from "../schemas/adminSchema.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";
import { parentSchema }   from "../schemas/parentSchema.js";

const SPECS = {
  admin:       ["Admin",    adminSchema],
  teacher:     ["Teacher",  teacherSchema],
  student:     ["Student",  studentSchema],
  "sub-admin": ["SubAdmin", subAdminSchema],
  parent:      ["Parent",   parentSchema],
};

/** Roles that sign in to a center and hold per-device sessions */
export const SESSION_ROLES = Object.keys(SPECS);

/** Normalise legacy spellings ("subAdmin") to the JWT role name */
export const normaliseRole = (role) => (role === "subAdmin" ? "sub-admin" : role);

/** Mongoose model for a role on a center connection, or null */
export function getUserModelForRole(db, role) {
  const spec = SPECS[normaliseRole(role)];
  if (!spec) return null;
  const [name, schema] = spec;
  return db.models[name] || db.model(name, schema);
}

/** Whether the account may still sign in (each role stores this differently) */
export function isAccountUsable(role, user) {
  if (!user) return false;
  if (normaliseRole(role) === "sub-admin") return user.status === "active";
  return user.active !== false;
}
