import { Connection, Document, Types } from 'mongoose'

// ─── Center (from master DB) ──────────────────────────────────────────────────

export interface CenterBranding {
  logo: string | null
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  favicon: string | null
  loginBackground: string | null
  loginBgOverlay: number
  borderRadius: string
  shadowStyle: string
  spacing: string
  theme: string | null
}

export interface ICenter extends Document {
  centerName: string
  slug: string
  customDomain: string | null
  adminEmail: string
  dbName: string
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  status: 'pending' | 'active' | 'suspended' | 'rejected' | 'deleted'
  branding: CenterBranding
  phone?: string
  country?: string
  website?: string
  address?: string
  timezone: string
  description?: string
  maxTeachers: number
  maxStudents: number
  domainVerified: boolean
  features: {
    agora: boolean
    googleMeet: boolean
    recording: boolean
    pronunciation: boolean
  }
  chatCredits: {
    balance: number
    totalAllocated: number
  }
}

// ─── JWT payload (set by verifyToken middleware) ───────────────────────────────

export interface JwtPayload {
  id: string
  email: string
  role: 'admin' | 'teacher' | 'student' | 'sub-admin' | 'super-admin'
  centerId: string
  username?: string
  isImpersonation?: boolean
}

// ─── Extend Express Request ───────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Per-center Mongoose connection — injected by tenantMiddleware */
      db: Connection

      /** Resolved center document — injected by tenantMiddleware */
      center: ICenter

      /** Decoded JWT payload — injected by verifyToken */
      user?: JwtPayload

      /** Authenticated teacher document — injected by requireTeacher */
      teacher?: Document & {
        _id: Types.ObjectId
        email: string
        firstName: string
        lastName: string
        active: boolean
        continent: string
        ratePerClass?: number
        twoFactorEnabled: boolean
      }

      /** Authenticated student document — injected by requireStudent */
      student?: Document & {
        _id: Types.ObjectId
        email: string
        firstName: string
        surname: string
        active: boolean
        twoFactorEnabled: boolean
      }

      /** Authenticated admin document — injected by requireAdmin */
      admin?: Document & {
        _id: Types.ObjectId | null
        email: string
        username: string
        firstName?: string
        lastName?: string
        active: boolean
        role: 'admin'
        isImpersonation?: boolean
      }

      /** Authenticated sub-admin document — injected by requireSubAdmin */
      subAdmin?: Document & {
        _id: Types.ObjectId
        email: string
        active: boolean
        assignmentType: 'region' | 'teacher'
      }

      /** Teacher filter scope — injected by requireSubAdmin */
      teacherScope?: Record<string, unknown>
    }
  }
}
