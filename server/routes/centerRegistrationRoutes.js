import express from 'express';
import bcrypt from 'bcryptjs';
import Center from '../models/master/Center.js';
import { config } from '../config/config.js';
import { sendEmail } from '../utils/emailService.js';
import { validateCenterRegistration } from '../middleware/validation.js';
import logger from "../utils/logger.js";

const router = express.Router();

// POST /api/register-center — public, no auth, no tenantMiddleware
router.post('/', validateCenterRegistration, async (req, res) => {
  try {
    const { centerName, slug, adminEmail, password, phone, country,
            website, description, timezone, address, maxTeachers, maxStudents, plan } = req.body;

    if (!centerName || !slug || !adminEmail || !password) {
      return res.status(400).json({ success: false, message: 'centerName, slug, adminEmail, and password are required' });
    }

    // Validate slug format: lowercase, alphanumeric + hyphens only
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ success: false, message: 'Slug may only contain lowercase letters, numbers, and hyphens' });
    }

    // Check slug uniqueness
    const existing = await Center.findOne({ slug });
    if (existing) {
      return res.status(409).json({ success: false, message: 'That slug is already taken. Please choose another.' });
    }

    const pendingPasswordHash = await bcrypt.hash(password, config.bcryptRounds);

    const center = await Center.create({
      centerName,
      slug,
      adminEmail,
      dbName: `db_${slug}`,
      pendingPasswordHash,
      phone:        phone        || undefined,
      country:      country      || undefined,
      website:      website      || undefined,
      description:  description  || undefined,
      timezone:     timezone     || 'UTC',
      address:      address      || undefined,
      maxTeachers:  maxTeachers  ? Number(maxTeachers) : undefined,
      maxStudents:  maxStudents  ? Number(maxStudents) : undefined,
      plan:         plan && ['free','basic','pro','enterprise'].includes(plan) ? plan : 'basic',
      registeredBy: adminEmail,
      status: 'pending',
    });

    // Email to the registrant
    try {
      await sendEmail({
        to: adminEmail,
        subject: `Registration received — ${config.appName}`,
        html: `
          <p>Hi,</p>
          <p>We received your registration request for <strong>${centerName}</strong>.</p>
          <p>Your application is currently <strong>pending review</strong>. We'll notify you by email once it has been approved.</p>
          <p>— The ${config.appName} Team</p>
        `,
      });
    } catch (e) {
      logger.error('Center registration email to applicant failed:', { error: e?.message });
    }

    // Notification to super admin
    if (config.superAdminEmail) {
      try {
        await sendEmail({
          to: config.superAdminEmail,
          subject: `New center registration pending — ${centerName}`,
          html: `
            <p>A new center has registered and is awaiting approval.</p>
            <ul>
              <li><strong>Name:</strong> ${centerName}</li>
              <li><strong>Slug:</strong> ${slug}</li>
              <li><strong>Admin email:</strong> ${adminEmail}</li>
              <li><strong>Country:</strong> ${country || 'N/A'}</li>
            </ul>
            <p>Log in to the super admin dashboard to review this application.</p>
          `,
        });
      } catch (e) {
        logger.error('Center registration notification to super admin failed:', { error: e?.message });
      }
    }

    res.status(201).json({ success: true, message: 'Registration received. Your application is pending approval.' });

  } catch (err) {
    logger.error('❌ Center registration error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
