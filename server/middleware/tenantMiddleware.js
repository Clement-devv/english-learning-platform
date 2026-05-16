// @ts-check
import Center from '../models/master/Center.js';
import { getDb } from '../config/dbManager.js';
import logger from "../utils/logger.js";
import { cachedQuery } from '../utils/cache.js';

// Cache TTL for resolved center documents.
// Short enough that status/branding changes propagate quickly;
// critical mutations (suspend, delete, domain change) explicitly bust the cache.
const TENANT_TTL = 60; // seconds

/**
 * Resolves the center from subdomain or custom domain.
 * Attaches req.center (plain Center object) and req.db (mongoose connection).
 * Result is cached in Redis keyed by slug or domain for TENANT_TTL seconds.
 *
 * Apply to ALL center-specific routes.
 * Do NOT apply to:
 *   /api/register-center
 *   /api/super-admin/*
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    // Strip port so "myschool.com:5000" and "myschool.com" resolve the same key.
    const host = (req.headers.host || '').split(':')[0];

    // 1. Try custom domain first (e.g. app.greenfieldacademy.com)
    // domainVerified must be true — unverified registrations must not resolve as tenants.
    const byCustomDomain = await cachedQuery(
      `tenant:domain:${host}`,
      TENANT_TTL,
      () => Center.findOne({ customDomain: host, status: 'active', domainVerified: true }).lean()
    );

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

    const center = await cachedQuery(
      `tenant:slug:${slug}`,
      TENANT_TTL,
      () => Center.findOne({ slug, status: 'active' }).lean()
    );

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
