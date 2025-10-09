// src/pages/student/UpcomingClasses.jsx
export default function UpcomingClasses({ upcomingClasses, enrollInClass }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">
        📅 Upcoming Classes
      </h3>
      {upcomingClasses.length === 0 ? (
        <p className="text-gray-500">No upcoming classes at the moment.</p>
      ) : (
        <div className="space-y-4">
          {upcomingClasses.map((cls) => (
            <div
              key={cls.id}
              className="flex justify-between items-center border-b border-gray-100 pb-3"
            >
              <div>
                <h4 className="font-semibold text-gray-700">{cls.title}</h4>
                <p className="text-sm text-gray-500">
                  {cls.teacher} • {cls.time}
                </p>
                <p className="text-sm text-gray-500 italic">{cls.topic}</p>
              </div>
              <button
                onClick={() => enrollInClass(cls.id)}
                disabled={cls.enrolled}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  cls.enrolled
                    ? "bg-green-100 text-green-700 cursor-default"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {cls.enrolled ? "Enrolled" : "Enroll"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
