// server/routes/v1.js
// All v1 API routes in one place.
// Mounted at /api/v1 in index.js.
// When a v2 is needed, create routes/v2.js and mount it at /api/v2 — no other files change.

import { Router } from "express";

import teacherRoutes             from "./teacherRoutes.js";
import studentRoutes             from "./studentRoutes.js";
import paymentRoutes             from "./paymentRoutes.js";
import lessonRoutes              from "./lessonRoutes.js";
import assignmentRoutes          from "./assignmentRoutes.js";
import authRoutes                from "./authRoutes.js";
import agoraRoutes               from "./agoraRoutes.js";
import agoraUsageRoutes          from "./agoraUsageRoutes.js";
import twoFactorRoutes           from "./twoFactorRoutes.js";
import bookingRoutes             from "./bookingRoutes.js";
import teacherAssignmentRoutes   from "./teacherAssignmentRoutes.js";
import classroomRoutes           from "./classroomRoutes.js";
import groupChatRoutes           from "./groupChatRoutes.js";
import directMessageRoutes       from "./directMessageRoutes.js";
import paymentTransactionRoutes  from "./paymentTransactionRoutes.js";
import recurringBookingsRoutes   from "./recurringBookingsRoutes.js";
import analyticsRoutes           from "./analyticsRoutes.js";
import adminLessonRoutes         from "./adminLessonRoutes.js";
import subAdminRoutes            from "./subAdminRoutes.js";
import subAdminAuthRoutes        from "./subAdminAuthRoutes.js";
import subAdminScopeRoutes       from "./subAdminScopeRoutes.js";
import disputeRoutes             from "./disputeRoutes.js";
import contentRoutes             from "./contentRoutes.js";
import teacherAvailabilityRoutes from "./teacherAvailabilityRoutes.js";
import homeworkRoutes            from "./homeworkRoutes.js";
import pronunciationRoutes       from "./pronunciationRoutes.js";
import quizRoutes                from "./quizRoutes.js";
import quizTemplateRoutes        from "./quizTemplateRoutes.js";
import grammarRoutes             from "./grammarRoutes.js";
import chatRoutes                from "./chatRoutes.js";
import vocabRoutes               from "./vocabRoutes.js";
import recordingRoutes           from "./recordingRoutes.js";
import reportRoutes              from "./reportRoutes.js";
import reviewRoutes              from "./reviewRoutes.js";
import referralRoutes            from "./referralRoutes.js";
import pushRoutes                from "./pushRoutes.js";
import notificationRoutes        from "./notificationRoutes.js";
import centerRegistrationRoutes  from "./centerRegistrationRoutes.js";
import centerConfigRoutes        from "./centerConfigRoutes.js";
import superAdminRoutes          from "./superAdminRoutes.js";
import classPricingRoutes        from "./classPricingRoutes.js";

const router = Router();

router.use("/teachers",             teacherRoutes);
router.use("/students",             studentRoutes);
router.use("/payments",             paymentRoutes);
router.use("/lessons",              lessonRoutes);
router.use("/assignments",          assignmentRoutes);
router.use("/auth",                 authRoutes);
router.use("/agora",                agoraRoutes);
router.use("/agora-usage",          agoraUsageRoutes);
router.use("/2fa",                  twoFactorRoutes);
router.use("/bookings",             bookingRoutes);
router.use("/teachers",             teacherAssignmentRoutes);
router.use("/classroom",            classroomRoutes);
router.use("/group-chats",          groupChatRoutes);
router.use("/direct-messages",      directMessageRoutes);
router.use("/payments",             paymentTransactionRoutes);
router.use("/recurring-bookings",   recurringBookingsRoutes);
router.use("/analytics",            analyticsRoutes);
router.use("/admin/lessons",        adminLessonRoutes);
router.use("/sub-admins",           subAdminRoutes);
router.use("/sub-admin-auth",       subAdminAuthRoutes);
router.use("/sub-admin-scope",      subAdminScopeRoutes);
router.use("/disputes",             disputeRoutes);
router.use("/content",              contentRoutes);
router.use("/teacher-availability", teacherAvailabilityRoutes);
router.use("/homework",             homeworkRoutes);
router.use("/pronunciation",        pronunciationRoutes);
router.use("/quiz",                 quizRoutes);
router.use("/quiz-templates",       quizTemplateRoutes);
router.use("/grammar",              grammarRoutes);
router.use("/chat",                 chatRoutes);
router.use("/vocab",                vocabRoutes);
router.use("/recordings",           recordingRoutes);
router.use("/reports",              reportRoutes);
router.use("/reviews",              reviewRoutes);
router.use("/referrals",            referralRoutes);
router.use("/push",                 pushRoutes);
router.use("/notifications",        notificationRoutes);
router.use("/register-center",      centerRegistrationRoutes);
router.use("/center",               centerConfigRoutes);
router.use("/super-admin",          superAdminRoutes);
router.use("/class-pricing",        classPricingRoutes);

export default router;
