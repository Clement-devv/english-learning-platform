// Standardised response helpers.
// All responses follow: { success: bool, ...data } or { success: bool, message: string }
// Use these in new/updated routes instead of inline res.status().json() calls.

export const ok          = (res, data = {})              => res.json({ success: true,  ...data });
export const created     = (res, data = {})              => res.status(201).json({ success: true,  ...data });
export const badRequest  = (res, message)                => res.status(400).json({ success: false, message });
export const unauthorized= (res, message = 'Unauthorized')=> res.status(401).json({ success: false, message });
export const forbidden   = (res, message = 'Forbidden')  => res.status(403).json({ success: false, message });
export const notFound    = (res, message = 'Not found')  => res.status(404).json({ success: false, message });
export const conflict    = (res, message)                => res.status(409).json({ success: false, message });
export const serverError = (res, message = 'Server error')=> res.status(500).json({ success: false, message });
