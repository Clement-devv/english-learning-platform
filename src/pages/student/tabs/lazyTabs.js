// src/pages/student/tabs/lazyTabs.js
// On-demand versions of the student dashboard tabs, shared by every shell
// (sunshine / crm / academy / playful). Each tab downloads the first time it
// is opened; see src/lib/lazyTab.jsx.

import { lazyTab, preloadWhenIdle } from '../../../lib/lazyTab';

export const StudentCompletedTab = lazyTab(() => import('./StudentCompletedTab'));
export const StudentScheduleTab  = lazyTab(() => import('./StudentScheduleTab'));
export const StudentHomeworkTab  = lazyTab(() => import('./HomeworkTab'));
export const StudentQuizTab      = lazyTab(() => import('./QuizTab'));
export const PronunciationTab    = lazyTab(() => import('./PronunciationTab'));
export const ConversationTab     = lazyTab(() => import('./ConversationTab'));
export const FlashcardsTab       = lazyTab(() => import('./FlashcardsTab'));
export const RecordingsTab       = lazyTab(() => import('./RecordingsTab'));
export const ReviewsTab          = lazyTab(() => import('./ReviewsTab'));
export const ReferralTab         = lazyTab(() => import('./ReferralTab'));
export const LeaderboardTab      = lazyTab(() => import('./LeaderboardTab'));
export const BookingCalendarTab  = lazyTab(() => import('./BookingCalendarTab'));
export const ClassReportsTab     = lazyTab(() => import('./ClassReportsTab'));
export const ChangePassword      = lazyTab(() => import('../../../components/student/auth/ChangePassword'));

// This module is first imported when a student dashboard shell loads, so the
// remaining tabs are warmed in the background right after the dashboard shows.
preloadWhenIdle([
  StudentScheduleTab, StudentHomeworkTab, StudentQuizTab, StudentCompletedTab,
  PronunciationTab, ConversationTab, FlashcardsTab, RecordingsTab,
  ReviewsTab, ReferralTab, LeaderboardTab, BookingCalendarTab, ClassReportsTab,
]);

// Not tabs, but only needed once the student opens Messages / joins a class.
// MessagesTab pulls in the emoji picker (~300 KB), so keeping it out of the
// shell's initial download matters.
export const MessagesTab = lazyTab(() => import('../../../components/chat/MessagesTab'));
export const Classroom   = lazyTab(() => import('../../Classroom'));
preloadWhenIdle([MessagesTab]);
