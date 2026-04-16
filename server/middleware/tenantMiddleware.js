// @ts-check
import Center from '../models/master/Center.js';
import { getDb } from '../config/dbManager.js';
import logger from "../utils/logger.js";

/**
 * Resolves the center from subdomain or custom domain.
 * Attaches req.center (Center doc) and req.db (mongoose connection).
 *
 * Apply to ALL center-specific routes.
 * Do NOT apply to:
 *   /api/register-center
 *   /api/super-admin/*
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    const host = req.headers.host || '';

    // 1. Try custom domain first (e.g. app.greenfieldacademy.com)
    const byCustomDomain = await Center.findOne({
      customDomain: host,
      status: 'active',
    });

    if (byCustomDomain) {
      req.center = byCustomDomain;
      req.db = await getDb(byCustomDomain.slug);
      return next();
    }

    // 2. Try subdomain: greenfield.yourapp.com -> slug = "greenfield"
    let slug = null;
    const parts = host.split('.');
    if (parts.length >= 3) {
      slug = parts[0];
    }

    // 3. Fallback: read from header (useful for mobile apps / API clients)
    if (!slug) {
      slug = req.headers['x-center-slug'];
    }

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Center not identified' });
    }

    const center = await Center.findOne({ slug, status: 'active' });
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found or inactive' });
    }

    req.center = center;
    req.db = await getDb(center.slug);
    next();
  } catch (err) {
    logger.error('Tenant middleware error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Tenant resolution failed' });
  }
};
