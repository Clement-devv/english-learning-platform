export default function ProgressCard({ progress }) {
  const completionPercentage = progress.totalLessons > 0
    ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
    : 0;

  const weeklyPercentage = progress.weeklyGoal > 0
    ? Math.round((progress.weeklyCompleted / progress.weeklyGoal) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Learning Progress</h3>

      {/* Total Classes Paid */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">Total Classes Paid</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {progress.totalLessons} classes
          </span>
        </div>
      </div>

      {/* Classes Completed */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">Classes Completed</span>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {progress.completedLessons} / {progress.totalLessons}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{completionPercentage}%</p>
      </div>

      {/* Classes Remaining */}
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Classes Remaining</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{progress.classesRemaining}</p>
          </div>
          <div className="text-4xl">📚</div>
        </div>
        {progress.classesRemaining === 0 && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            ⚠️ You have no classes remaining. Please contact admin to purchase more.
          </p>
        )}
        {progress.classesRemaining > 0 && progress.classesRemaining <= 5 && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
            ⚠️ Running low! Only {progress.classesRemaining} classes left.
          </p>
        )}
      </div>

      {/* Current Streak */}
      <div className="flex items-center gap-4 mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
        <div className="text-3xl">🔥</div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Current Streak</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{progress.streakDays} days</p>
        </div>
      </div>

      {/* Weekly Goal */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">Weekly Goal</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {progress.weeklyCompleted} / {progress.weeklyGoal} classes
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(weeklyPercentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
