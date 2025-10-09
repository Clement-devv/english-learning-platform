
import express from "express";
import pkg from "agora-access-token";
import dotenv from "dotenv";

dotenv.config();

const { RtcTokenBuilder, RtcRole } = pkg;
const router = express.Router();

router.get("/token", (req, res) => {
  try {
    const appID = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const channelName = req.query.channel;
    const uid = req.query.uid || 0;

    if (!appID || !appCertificate) {
      return res.status(500).json({ error: "Agora credentials missing" });
    }
    if (!channelName) {
      return res.status(400).json({ error: "Channel name is required" });
    }

    const role = RtcRole.PUBLISHER;
    const expireTime = 3600; // 1 hour
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );

    return res.json({ token });
  } catch (error) {
    console.error("Agora token error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;

