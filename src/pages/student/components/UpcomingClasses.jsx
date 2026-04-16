// src/pages/student/components/UpcomingClasses.jsx
import { getUserTimezone, dualTime, tzCity } from "../../../utils/timezone";

export default function UpcomingClasses({ upcomingClasses, onEnroll }) {
  const myTZ = getUserTimezone();

  if (upcomingClasses.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
        No upcoming classes at the moment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {upcomingClasses.map((cls) => {
        const dual = cls.scheduledTime
          ? dualTime(cls.scheduledTime, myTZ, cls.teacherTimezone)
          : null;
        const showTeacherTZ = dual && !dual.sameZone && cls.teacherTimezone;

        return (
          <div
            key={cls.id}
            className="flex justify-between items-start gap-3 border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0 last:pb-0"
          >
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">{cls.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">{cls.teacher}</p>

              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                {dual ? `${dual.myTime} ${dual.myAbbr}` : cls.time}
              </p>

              {showTeacherTZ && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400">
                  Teacher ({tzCity(cls.teacherTimezone)}): {dual.theirTime} {dual.theirAbbr}
                </p>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500 italic">{cls.topic}</p>
            </div>

            <button
              onClick={() => onEnroll?.(cls.id)}
              disabled={cls.enrolled}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                cls.enrolled
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default"
                  : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white"
              }`}
            >
              {cls.enrolled ? "Enrolled" : "Enroll"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
