// server/routes/agoraUsageRoutes.js
// Called by the frontend VideoCall component when a session ends.
// Uses tenantMiddleware to identify the center from the request.

import express from 'express';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import AgoraUsage from '../models/master/AgoraUsage.js';
import logger from "../utils/logger.js";

const router = express.Router();

// POST /api/agora-usage/log
// Frontend calls this when an Agora session ends.
// Body: { channelName, bookingId, durationMinutes, participantCount }
router.post('/log', tenantMiddleware, verifyToken, async (req, res) => {
  try {
    const { channelName, bookingId, durationMinutes, participantCount } = req.body;

    if (typeof durationMinutes !== 'number' || durationMinutes < 0) {
      return res.status(400).json({ success: false, message: 'durationMinutes must be a non-negative number' });
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

export default router;
