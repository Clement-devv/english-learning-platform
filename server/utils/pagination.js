/**
 * Parses and bounds-checks pagination query parameters.
 * @param {object} query - req.query
 * @param {number} defaultLimit - default page size (default: 50)
 * @param {number} maxLimit - maximum allowed page size (default: 500)
 * @returns {{ limit: number, skip: number }}
 */
export function parsePagination(query, defaultLimit = 50, maxLimit = 500) {
  const rawLimit = parseInt(query.limit, 10);
  const rawSkip  = parseInt(query.skip,  10);

  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit, maxLimit);
  const skip  = Number.isFinite(rawSkip)  && rawSkip  > 0 ? rawSkip  : 0;

  return { limit, skip };
}
