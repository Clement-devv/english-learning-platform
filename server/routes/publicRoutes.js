// server/routes/publicRoutes.js
// Unauthenticated public endpoints — resolved via tenant middleware.
// Mounted at /api/v1/public in v1.js.

import express from 'express';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
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

export default router;
