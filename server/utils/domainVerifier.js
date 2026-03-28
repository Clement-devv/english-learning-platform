// server/utils/domainVerifier.js
import dns from 'dns/promises';

/**
 * Check if a domain's A record points to our server IP.
 * Returns { verified: true } or { verified: false, message }
 */
export const verifyDomainDns = async (domain, expectedIp) => {
  try {
    const lookupDomain = domain.replace(/^www\./, '');

    const addresses = await dns.resolve4(lookupDomain);
    if (addresses.includes(expectedIp)) return { verified: true };

    // Also try with www prefix
    try {
      const wwwAddresses = await dns.resolve4(`www.${lookupDomain}`);
      if (wwwAddresses.includes(expectedIp)) return { verified: true };
    } catch { /* ignore */ }

    return {
      verified: false,
      message: `Domain points to ${addresses[0]} but expected ${expectedIp}`,
    };
  } catch (err) {
    return {
      verified: false,
      message: `DNS lookup failed: ${err.message}. DNS may not have propagated yet (up to 48h).`,
    };
  }
};

/**
 * Validate domain format — no paths, no ports, no protocol
 */
export const isValidDomain = (domain) => {
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  const clean = domain.replace(/^www\./, '').toLowerCase().trim();
  return domainRegex.test(clean);
};

/**
 * Normalize domain — strip protocol, path, port
 */
export const normalizeDomain = (input) => {
  return input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .trim();
};
