
import { useTranslation } from "react-i18next";
import { Target, CheckCircle2 } from "lucide-react";
import { StickerIcon } from "../../../components/dashboard/DoodleArt";

// Sunshine look — dashboard tokens + topic colours, lucide icons (no emoji, no purple).
// Other shells keep the original card below.
function SunshineProgress({ progress, tr, completionPercentage, weeklyPercentage }) {
  const low = progress.classesRemaining > 0 && progress.classesRemaining <= 5;
  const Bar = ({ pct, fill, h = 10 }) => (
    <div style={{ height: h, borderRadius: 999, background: "var(--a-raised)", boxShadow: "inset 0 0 0 1px var(--a-line)", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 999, background: fill, transition: "width 500ms cubic-bezier(0.23, 1, 0.32, 1)" }} />
    </div>
  );
  const Chip = ({ sticker }) => (
    <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--a-surface)", boxShadow: "0 6px 16px -8px var(--cat), inset 0 0 0 1px var(--cat-line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <StickerIcon name={sticker} size={38} />
    </div>
  );
  const label = { fontSize: 13, color: "var(--a-ink-2)", fontWeight: 600 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>{tr("progressCard.totalClassesPaid")}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--a-ink)" }}>{tr("progressCard.classes", { totalLessons: progress.totalLessons })}</span>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color="var(--a-accent)" />{tr("progressCard.classesCompleted")}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--a-accent-ink)", fontVariantNumeric: "tabular-nums" }}>{progress.completedLessons} / {progress.totalLessons}</span>
        </div>
        <Bar pct={completionPercentage} fill="var(--a-accent-grad)" />
        <div style={{ fontSize: 11.5, color: "var(--a-muted)", fontWeight: 700, textAlign: "right", marginTop: 4 }}>{completionPercentage}%</div>
      </div>

      <div className="cat-pink" style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, background: "var(--cat-soft)", border: "1px solid var(--cat-line)" }}>
        <Chip sticker="bookStack" />
        <div style={{ minWidth: 0 }}>
          <div style={label}>{tr("progressCard.classesRemaining")}</div>
          <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, color: "var(--cat-ink)", fontVariantNumeric: "tabular-nums" }}>{progress.classesRemaining}</div>
          {progress.classesRemaining === 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginTop: 4 }}>{tr("progressCard.youHaveNoClassesRemaining")}</div>}
          {low && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cat-ink)", marginTop: 4 }}>{tr("progressCard.runningLowOnlyClassesLeft", { classesRemaining: progress.classesRemaining })}</div>}
        </div>
      </div>

      <div className="cat-amber" style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, background: "var(--cat-soft)", border: "1px solid var(--cat-line)" }}>
        <Chip sticker="flame" />
        <div>
          <div style={label}>{tr("progressCard.currentStreak")}</div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.15, color: "var(--cat-ink)" }}>{tr("progressCard.days", { streakDays: progress.streakDays })}</div>
        </div>
      </div>

      <div className="cat-green">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><Target size={15} color="var(--cat)" />{tr("progressCard.weeklyGoal")}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--cat-ink)", fontVariantNumeric: "tabular-nums" }}>{tr("progressCard.classes2", { weeklyCompleted: progress.weeklyCompleted, weeklyGoal: progress.weeklyGoal })}</span>
        </div>
        <Bar pct={weeklyPercentage} fill="var(--cat)" h={8} />
      </div>
    </div>
  );
}

export default function ProgressCard({ progress, sunshine = false }) {
  const { t: tr } = useTranslation("student");
  const completionPercentage = progress.totalLessons > 0
    ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
    : 0;

  const weeklyPercentage = progress.weeklyGoal > 0
    ? Math.round((progress.weeklyCompleted / progress.weeklyGoal) * 100)
    : 0;

  if (sunshine) return <SunshineProgress progress={progress} tr={tr} completionPercentage={completionPercentage} weeklyPercentage={weeklyPercentage} />;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{tr("progressCard.learningProgress")}</h3>

      {/* Total Classes Paid */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">{tr("progressCard.totalClassesPaid")}</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {tr("progressCard.classes", { totalLessons: progress.totalLessons })}</span>
        </div>
      </div>

      {/* Classes Completed */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">{tr("progressCard.classesCompleted")}</span>
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
            <p className="text-sm text-gray-600 dark:text-gray-300">{tr("progressCard.classesRemaining")}</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{progress.classesRemaining}</p>
          </div>
          <div className="text-4xl">📚</div>
        </div>
        {progress.classesRemaining === 0 && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            {tr("progressCard.youHaveNoClassesRemaining")}
          </p>
        )}
        {progress.classesRemaining > 0 && progress.classesRemaining <= 5 && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">{tr("progressCard.runningLowOnlyClassesLeft", { classesRemaining: progress.classesRemaining })}</p>
        )}
      </div>

      {/* Current Streak */}
      <div className="flex items-center gap-4 mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
        <div className="text-3xl">🔥</div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{tr("progressCard.currentStreak")}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{tr("progressCard.days", { streakDays: progress.streakDays })}</p>
        </div>
      </div>

      {/* Weekly Goal */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-300">{tr("progressCard.weeklyGoal")}</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {tr("progressCard.classes2", { weeklyCompleted: progress.weeklyCompleted, weeklyGoal: progress.weeklyGoal })}</span>
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
