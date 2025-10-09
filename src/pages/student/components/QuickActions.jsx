// src/pages/student/QuickActions.jsx
import { BookOpen, MessageSquare, Video, Trophy } from "lucide-react";

export default function QuickActions() {
  const actions = [
    { id: 1, label: "View Materials", icon: <BookOpen size={18} />, color: "bg-blue-100 text-blue-700" },
    { id: 2, label: "Join Chat", icon: <MessageSquare size={18} />, color: "bg-green-100 text-green-700" },
    { id: 3, label: "Video Library", icon: <Video size={18} />, color: "bg-purple-100 text-purple-700" },
    { id: 4, label: "Achievements", icon: <Trophy size={18} />, color: "bg-yellow-100 text-yellow-700" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        ⚙️ Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            className={`flex flex-col items-center justify-center py-3 rounded-xl font-medium text-sm hover:scale-105 transition-transform duration-300 ${action.color}`}
          >
            {action.icon}
            <span className="mt-1">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
