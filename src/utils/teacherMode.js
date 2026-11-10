import { decodeJwtPayload } from './jwt';
export const teacherModeKey = () => {
  try {
    const token = sessionStorage.getItem('teacherToken');
    const p = decodeJwtPayload(token);
    return p?.realm === 'teacher-mode' ? p.centerId : null;
  } catch { return null; }
};
export const teacherModeLink = (path) => {
  const key = teacherModeKey();
  return `${window.location.origin}${path}${key ? `${path.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(key)}` : ''}`;
};

// Match the regular teacher classroom contract for both individual and group lessons.
export const studioClassroomState = (lesson, teacher = {}) => ({
  userRole: 'teacher',
  classData: {
    ...lesson,
    id: lesson._id,
    bookingId: lesson._id,
    title: lesson.classTitle || lesson.title,
    isGroupClass: !!lesson.isGroupClass,
    students: lesson.isGroupClass
      ? (lesson.enrollments || []).map(e => e.studentId)
      : [lesson.studentId].filter(Boolean),
    teacher: [teacher.firstName, teacher.lastName].filter(Boolean).join(' '),
  },
});
