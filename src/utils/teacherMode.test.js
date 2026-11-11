import { beforeEach, describe, expect, it } from 'vitest';
import { classroomDashboardPath } from './teacherMode';

describe('classroom dashboard return route', () => {
  beforeEach(() => sessionStorage.clear());
  it('returns standalone teachers to their own workspace', () => {
    sessionStorage.setItem('teacherToken', `header.${btoa(JSON.stringify({ realm: 'teacher-mode', centerId: 'tw-demo' }))}.signature`);
    expect(classroomDashboardPath('teacher')).toBe('/teacher-mode/dashboard');
    expect(classroomDashboardPath('student')).toBe('/student/dashboard');
  });
  it('preserves center teacher and student routes', () => {
    sessionStorage.setItem('teacherToken', `header.${btoa(JSON.stringify({ role: 'teacher', centerId: 'academy' }))}.signature`);
    expect(classroomDashboardPath('teacher')).toBe('/teacher/dashboard');
    expect(classroomDashboardPath('student')).toBe('/student/dashboard');
  });
});
