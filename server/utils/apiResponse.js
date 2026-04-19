// Standardised response helpers.
// All responses follow: { success: bool, ...data } or { success: bool, message: string }
// Use these in new/updated routes instead of inline res.status().json() calls.

/**
 * 200 OK — success response with optional data payload.
 * @param {import('express').Response} res
 * @param {object} [data={}] - Extra fields merged into the response body.
 * @returns {void}
 */
export const ok          = (res, data = {})               => res.json({ success: true,  ...data });

/**
 * 201 Created — resource was created successfully.
 * @param {import('express').Response} res
 * @param {object} [data={}] - Extra fields merged into the response body.
 * @returns {void}
 */
export const created     = (res, data = {})               => res.status(201).json({ success: true,  ...data });

/**
 * 400 Bad Request — invalid input from the client.
 * @param {import('express').Response} res
 * @param {string} message - Human-readable description of what was wrong.
 * @returns {void}
 */
export const badRequest  = (res, message)                 => res.status(400).json({ success: false, message });

/**
 * 401 Unauthorized — missing or invalid authentication.
 * @param {import('express').Response} res
 * @param {string} [message='Unauthorized']
 * @returns {void}
 */
export const unauthorized= (res, message = 'Unauthorized')=> res.status(401).json({ success: false, message });

/**
 * 403 Forbidden — authenticated but not allowed.
 * @param {import('express').Response} res
 * @param {string} [message='Forbidden']
 * @returns {void}
 */
export const forbidden   = (res, message = 'Forbidden')   => res.status(403).json({ success: false, message });

/**
 * 404 Not Found — resource does not exist.
 * @param {import('express').Response} res
 * @param {string} [message='Not found']
 * @returns {void}
 */
export const notFound    = (res, message = 'Not found')   => res.status(404).json({ success: false, message });

/**
 * 409 Conflict — state conflict (e.g. duplicate, optimistic lock).
 * @param {import('express').Response} res
 * @param {string} message
 * @returns {void}
 */
export const conflict    = (res, message)                 => res.status(409).json({ success: false, message });

/**
 * 500 Internal Server Error — unexpected server-side failure.
 * @param {import('express').Response} res
 * @param {string} [message='Server error']
 * @returns {void}
 */
export const serverError = (res, message = 'Server error')=> res.status(500).json({ success: false, message });
