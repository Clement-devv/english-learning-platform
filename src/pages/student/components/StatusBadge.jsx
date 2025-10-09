// src/pages/student/components/StatusBadge.jsx
export default function StatusBadge({ status }) {
  if (status === "live")
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <div className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></div>
        LIVE
      </span>
    );

  if (status === "starting-soon")
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
        STARTING SOON
      </span>
    );

  return null;
}
