import AuditLog from '../models/master/AuditLog.js';
import { logger } from '../utils/logger.js';

/**
 * Write an audit log entry. Never throws — a failed write must not break the request.
 *
 * @param {object} opts
 * @param {string}  opts.action          - e.g. 'CENTER_APPROVED'
 * @param {object}  opts.superAdmin      - req.superAdmin object
 * @param {string}  [opts.targetId]      - ID of the entity being acted on
 * @param {string}  [opts.targetName]    - Human-readable name of the target
 * @param {object}  [opts.details]       - Any extra context to store
 * @param {string}  [opts.ip]            - req.ip
 */
export async function writeAuditLog({ action, superAdmin, targetId, targetName, details, ip }) {
  try {
    await AuditLog.create({
      action,
      performedBy:      superAdmin?._id?.toString() ?? 'unknown',
      performedByEmail: superAdmin?.email ?? '',
      targetId:         targetId  ?? null,
      targetName:       targetName ?? null,
      details:          details   ?? {},
      ip:               ip        ?? null,
    });
  } catch (err) {
    // Non-blocking: audit log failure should never break the primary operation
    logger.error('[AuditLog] Write failed:', { error: err?.message });
  }
}
