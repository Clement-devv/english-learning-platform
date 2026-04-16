// src/pages/student/components/ActiveClasses.jsx
import StatusBadge from "./StatusBadge";
import { getUserTimezone, dualTime, tzCity } from "../../../utils/timezone";

export default function ActiveClasses({ activeClasses, onJoin }) {
  const myTZ = getUserTimezone();

  if (activeClasses.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
        No active classes right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {activeClasses.map((cls) => {
        const dual = cls.scheduledTime
          ? dualTime(cls.scheduledTime, myTZ, cls.teacherTimezone)
          : null;
        const showTeacherTZ = dual && !dual.sameZone && cls.teacherTimezone;

        return (
          <div
            key={cls.id}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{cls.title}</h4>
                  <StatusBadge status={cls.status} />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-0.5">👩‍🏫 {cls.teacher}</p>

                <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-0.5">
                  🕒 {dual ? `${dual.myTime} ${dual.myAbbr}` : cls.time}
                </p>

                {showTeacherTZ && (
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-0.5">
                    Teacher ({tzCity(cls.teacherTimezone)}): {dual.theirTime} {dual.theirAbbr}
                  </p>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400">📚 {cls.topic}</p>
              </div>

              <button
                onClick={() => onJoin(cls)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 hover:scale-105 ${
                  cls.status === "live"
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {cls.status === "live" ? "Join Live" : "Join Call"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
