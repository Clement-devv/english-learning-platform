// src/pages/student/components/ActiveClasses.jsx
import StatusBadge from "./StatusBadge";

export default function ActiveClasses({ activeClasses, onJoin }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Active Classes</h3>
        <span className="text-sm text-gray-500">{activeClasses.length} classes available</span>
      </div>

      <div className="space-y-4">
        {activeClasses.map((cls) => (
          <div key={cls.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="font-semibold text-gray-900">{cls.title}</h4>
                  <StatusBadge status={cls.status} />
                </div>
                <p className="text-sm text-gray-600 mb-1">👩‍🏫 {cls.teacher}</p>
                <p className="text-sm text-gray-600 mb-1">🕒 {cls.time}</p>
                <p className="text-sm text-gray-600 mb-3">📚 Topic: {cls.topic}</p>
              </div>

              <button
                onClick={() => onJoin(cls.id, cls.title)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 ${
                  cls.status === "live"
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {cls.status === "live" ? "Join Live" : "Join Call"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
