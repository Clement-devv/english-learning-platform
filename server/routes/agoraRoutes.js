// server/routes/agoraRoutes.js
import express from 'express';
import pkg from 'agora-access-token';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import logger from "../utils/logger.js";
const { RtcTokenBuilder, RtcRole } = pkg;

const router = express.Router();

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// Agora tokens must only be issued to authenticated users belonging to this center.
router.get('/token', tenantMiddleware, verifyToken, (req, res) => {
  try {
    const { channel } = req.query;

    logger.info('📞 Token request:', { channel, userId: req.user?.id, center: req.center?.slug });

    if (!channel) {
      return res.status(400).json({
        success: false,
        message: 'Channel name is required'
      });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      logger.error('❌ Agora credentials missing!');
      return res.status(500).json({
        success: false,
        message: 'Video calling not configured'
      });
    }

    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Use numeric UID 0 (wildcard) — the SDK assigns a random UID at join time.
    // This is the standard, most reliable Agora pattern and avoids all string-UID
    // resolution issues that can silently prevent user-published events from firing.
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      0,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    logger.info('✅ Token generated for channel:', channel);

    res.json({
      success: true,
      token,
      appId: APP_ID,
      channel,
      uid: 0,
      expiresAt: new Date(privilegeExpiredTs * 1000).toISOString()
    });

  } catch (error) {
    logger.error('❌ Token generation error:', { error: error?.message });
    res.status(500).json({
      success: false,
      message: 'Failed to generate token'
    });
  }
});

router.get('/status', (_req, res) => {
  const isConfigured = !!(APP_ID && APP_CERTIFICATE);
  res.json({
    success: true,
    configured: isConfigured,
    message: isConfigured ? '✅ Configured' : '⚠️ Not configured'
  });
});

export default router;
