// src/pages/classroom/CtrlBtn.jsx
// Small round control button, styled like the Google Meet control bar.
// Shared by the Google Meet and Zoom classroom pages. The label shows as a
// tooltip on hover.

export default function CtrlBtn({ onClick, label, active = false, tone = "default", disabled = false, wide = false, children }) {
  const tones = {
    default: active
      ? "bg-pink-500 text-white shadow-md shadow-pink-300/60"
      : "bg-pink-50 text-pink-600 hover:bg-pink-100",
    green: "bg-emerald-500 text-white hover:bg-emerald-400 shadow-md shadow-emerald-300/50",
    blue:  "bg-[#2D8CFF] text-white hover:bg-[#1a7de8] shadow-md shadow-sky-300/50",
    red:   "bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-300/60",
  };
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`h-11 ${wide ? "px-5 min-w-[64px]" : "w-11"} rounded-full flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${tones[tone]}`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </div>
  );
}
