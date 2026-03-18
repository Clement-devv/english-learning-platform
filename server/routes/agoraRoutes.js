// server/routes/agoraRoutes.js
import express from 'express';
import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;

const router = express.Router();

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

router.get('/token', (req, res) => {
  try {
    const { channel } = req.query;

    console.log('📞 Token request:', { channel });

    if (!channel) {
      return res.status(400).json({
        success: false,
        message: 'Channel name is required'
      });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      console.error('❌ Agora credentials missing!');
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

    console.log('✅ Token generated for channel:', channel);

    res.json({
      success: true,
      token,
      appId: APP_ID,
      channel,
      uid: 0,
      expiresAt: new Date(privilegeExpiredTs * 1000).toISOString()
    });

  } catch (error) {
    console.error('❌ Token generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate token',
      error: error.message
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
