import type { Response } from 'express'

// Centralised response helpers — use these in new routes instead of
// calling res.status().json() inline everywhere.
//
// This fixes the inconsistent response shapes across routes (some return
// { message }, some return { success, message }, etc.).
// All helpers here follow the same shape: { success, ...data } or { success, message }.

export const ok = (res: Response, data: Record<string, unknown> = {}) =>
  res.json({ success: true, ...data })

export const created = (res: Response, data: Record<string, unknown> = {}) =>
  res.status(201).json({ success: true, ...data })

export const badRequest = (res: Response, message: string) =>
  res.status(400).json({ success: false, message })

export const unauthorized = (res: Response, message = 'Unauthorized') =>
  res.status(401).json({ success: false, message })

export const forbidden = (res: Response, message = 'Forbidden') =>
  res.status(403).json({ success: false, message })

export const notFound = (res: Response, message = 'Not found') =>
  res.status(404).json({ success: false, message })

export const conflict = (res: Response, message: string) =>
  res.status(409).json({ success: false, message })

export const serverError = (res: Response, message = 'Internal server error') =>
  res.status(500).json({ success: false, message })
