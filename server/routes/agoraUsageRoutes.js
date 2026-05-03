// server/routes/agoraUsageRoutes.js
// Agora session tracking.
// /start + /end  → accurate server-anchored tracking (teacher only, no double-counting)
// /log           → legacy endpoint kept for backwards compatibility

import express from 'express';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import AgoraUsage   from '../models/master/AgoraUsage.js';
import AgoraSession from '../models/master/AgoraSession.js';
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();

// POST /api/agora-usage/log
// Frontend calls this when an Agora session ends.
// Body: { channelName, bookingId, durationMinutes, participantCount }
router.post('/log', tenantMiddleware, verifyToken, async (req, res) => {
  try {
    const { channelName, bookingId, durationMinutes, participantCount } = req.body;

    if (typeof durationMinutes !== 'number' || durationMinutes < 0) {
      return badRequest(res, 'durationMinutes must be a non-negative number');
    }

    // Skip logging zero-second joins (user connected then immediately left)
    if (durationMinutes === 0) {
      return res.json({ success: true, message: 'Session too short — not logged' });
    }

    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await AgoraUsage.create({
      centerId:         req.center.slug,
      centerName:       req.center.centerName,
      channelName:      channelName || null,
      bookingId:        bookingId   || null,
      durationMinutes:  Math.ceil(durationMinutes),
      participantCount: participantCount || 2,
      sessionDate:      now,
      month,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('❌ Agora usage log error:', { error: err?.message });
    // Non-critical — don't surface errors to the user during a call
    res.status(500).json({ success: false, message: 'Failed to log usage' });
  }
});

// ── POST /api/agora-usage/start ─────────────────────────────────────────────
// Teacher calls this when they successfully join an Agora channel.
// If the session is already active (teacher reconnected after a refresh/blip),
// the original startedAt is preserved so no time is lost.
// If the session is new or was previously completed, startedAt resets to now.
router.post('/start', tenantMiddleware, verifyToken, async (req, res) => {
  try {
    const { channelName, bookingId } = req.body;
    if (!bookingId) return badRequest(res, 'bookingId required');

    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Preserve startedAt for active sessions (teacher reconnected) so no minutes are lost
    const existing  = await AgoraSession.findOne({ bookingId }).lean();
    const startedAt = (existing && existing.status === 'active') ? existing.startedAt : now;

    await AgoraSession.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          centerId:        req.center.slug,
          centerName:      req.center.centerName,
          channelName:     channelName || null,
          startedAt,
          endedAt:         null,
          durationSeconds: 0,
          durationMinutes: 0,
          status:          'active',
          month,
        },
      },
      { upsert: true, new: true },
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('❌ Agora session start error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Failed to start session' });
  }
});

// ── POST /api/agora-usage/end ───────────────────────────────────────────────
// Teacher calls this when leaving an Agora channel.
// Duration is computed server-side from startedAt — immune to client-side clock issues.
router.post('/end', tenantMiddleware, verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return badRequest(res, 'bookingId required');

    const session = await AgoraSession.findOne({ bookingId });
    if (!session) return res.json({ success: true, message: 'No active session found' });

    const endedAt         = new Date();
    const durationSeconds = Math.max(0, Math.floor((endedAt - session.startedAt) / 1000));
    const durationMinutes = durationSeconds > 0 ? Math.ceil(durationSeconds / 60) : 0;

    await AgoraSession.findOneAndUpdate(
      { bookingId },
      {
        $set: {
          endedAt,
          durationSeconds,
          durationMinutes,
          status: 'completed',
        },
      },
    );

    res.json({ success: true, durationMinutes });
  } catch (err) {
    logger.error('❌ Agora session end error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Failed to end session' });
  }
});

export default router;
