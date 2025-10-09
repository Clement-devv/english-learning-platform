// src/pages/student/ProgressCard.jsx
export default function ProgressCard({ progress }) {
  const percentComplete = Math.round(
    (progress.completedLessons / progress.totalLessons) * 100
  );

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        📈 Learning Progress
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Completed Lessons:</span>
          <span>
            {progress.completedLessons}/{progress.totalLessons}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Streak:</span>
          <span>{progress.streakDays} days 🔥</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Weekly Goal:</span>
          <span>
            {progress.weeklyCompleted}/{progress.weeklyGoal} lessons
          </span>
        </div>
      </div>
    </div>
  );
}
