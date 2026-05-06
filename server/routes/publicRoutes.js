// server/routes/publicRoutes.js
// Unauthenticated public endpoints — resolved via tenant middleware.
// Mounted at /api/v1/public in v1.js.

import express from 'express';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { sendEmail }        from '../emails/core.js';
import logger from '../utils/logger.js';
import { notFound, serverError } from '../utils/apiResponse.js';

const router = express.Router();

// GET /api/v1/public/landing-page
// Returns the published landing page for the current center (resolved by subdomain / custom domain).
// Returns 404 if center not found or landing page is not published.
router.get('/landing-page', tenantMiddleware, async (req, res) => {
  try {
    const { center } = req;
    const lp = center.landingPage;

    if (!lp || !lp.published) {
      return notFound(res, 'No public landing page for this center');
    }

    // Only expose safe public fields — never expose dbName, credits, pendingPasswordHash etc.
    res.json({
      success: true,
      center: {
        centerName:  center.centerName,
        slug:        center.slug,
        logo:        center.branding?.logo || null,
        favicon:     center.branding?.favicon || null,
        description: center.description || '',
        country:     center.country || '',
        phone:       center.phone || '',
        website:     center.website || '',
      },
      landingPage: {
        template:    lp.template,
        design:      lp.design,
        hero:        lp.hero,
        about:       lp.about,
        teachers:    lp.teachers || [],
        links:       lp.links,
        contact:     lp.contact,
        seo:         lp.seo,
        publishedAt: lp.publishedAt,
      },
    });
  } catch (err) {
    logger.error('Error fetching public landing page:', { error: err?.message });
    serverError(res);
  }
});

// POST /api/v1/public/contact
// Receives the Clemify company landing page contact form and emails clem.emmy01@gmail.com.
// No tenantMiddleware — this is a platform-level endpoint, not center-specific.
router.post('/contact', async (req, res) => {
  try {
    const { name, organization, email, phone, service, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    const serviceLabel = {
      'school-setup': 'Setting up a school on Clemify',
      'demo':         'Requesting a live demo',
      'pricing':      'Pricing information',
      'partnership':  'Partnership inquiry',
      'other':        'Other',
    }[service] || service || '—';

    await sendEmail({
      centerName: 'Clemify',
      to:         'clem.emmy01@gmail.com',
      subject:    `New Contact Request — ${name}`,
      html: `
        <h2 style="font-family:sans-serif;color:#1e293b">New Contact Request</h2>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:560px">
          <tr><td style="padding:8px 0;color:#64748b;width:160px">Name</td><td style="padding:8px 0">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Organization</td><td style="padding:8px 0">${organization || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Phone</td><td style="padding:8px 0">${phone || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Interested in</td><td style="padding:8px 0">${serviceLabel}</td></tr>
        </table>
        <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0"/>
        <p style="font-family:sans-serif;font-size:14px;color:#64748b;margin-bottom:6px">Message:</p>
        <p style="font-family:sans-serif;font-size:14px;color:#1e293b;white-space:pre-wrap">${message}</p>
      `,
    });

    logger.info(`Contact form submitted by ${email}`);
    res.json({ success: true, message: 'Request received! We will reach out within 24 hours.' });
  } catch (err) {
    logger.error('Contact form error:', { error: err?.message });
    serverError(res);
  }
});

export default router;
