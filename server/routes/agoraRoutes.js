// server/routes/agoraRoutes.js - STRING UID VERSION (FINAL)
import express from 'express';
import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;

const router = express.Router();

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

router.get('/token', (req, res) => {
  try {
    const { channel, uid } = req.query;
    
    console.log('📞 Token request:', { channel, uid });
    
    if (!channel || !uid) {
      return res.status(400).json({
        success: false,
        message: 'Channel name and UID are required'
      });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      console.error('❌ Agora credentials missing!');
      return res.status(500).json({
        success: false,
        message: 'Video calling not configured'
      });
    }

    // Use string UID (MongoDB ObjectId works perfectly)
    const stringUid = String(uid);
    console.log(`✅ Using string UID: ${stringUid}`);

    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Use buildTokenWithAccount for string UIDs
    const token = RtcTokenBuilder.buildTokenWithAccount(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      stringUid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    console.log('✅ Token generated with string UID');

    res.json({
      success: true,
      token,
      appId: APP_ID,
      channel,
      uid: stringUid,
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

router.get('/status', (req, res) => {
  const isConfigured = !!(APP_ID && APP_CERTIFICATE);
  res.json({
    success: true,
    configured: isConfigured,
    message: isConfigured ? '✅ Configured' : '⚠️ Not configured'
  });
});

export default router;