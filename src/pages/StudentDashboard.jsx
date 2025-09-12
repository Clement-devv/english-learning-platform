import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const [student, setStudent] = useState({ name: "John Doe", level: "Intermediate" });
  const [activeClasses, setActiveClasses] = useState([

    {
      id: 1,
      title: "English Conversation - Beginner",
      teacher: "Ms. Sarah Johnson",
      time: "2:00 PM - 3:00 PM",
      participants: 8,
      maxParticipants: 12,
      status: "live",
      topic: "Daily Routines & Habits"
    },
    {
      id: 2,
      title: "Business English",
      teacher: "Mr. David Wilson",
      time: "4:00 PM - 5:00 PM",
      participants: 6,
      maxParticipants: 10,
      status: "starting-soon",
      topic: "Professional Presentations"
    }
  ]);

  const [upcomingClasses, setUpcomingClasses] = useState([
    {
      id: 3,
      title: "Grammar Workshop",
      teacher: "Ms. Emily Chen",
      time: "Tomorrow 10:00 AM",
      topic: "Past Perfect Tense",
      enrolled: true
    },
    {
      id: 4,
      title: "Pronunciation Practice",
      teacher: "Mr. James Miller",
      time: "Friday 3:00 PM",
      topic: "American vs British Accent",
      enrolled: false
    }
  ]);

  const [progress, setProgress] = useState({
    completedLessons: 24,
    totalLessons: 40,
    streakDays: 7,
    weeklyGoal: 5,
    weeklyCompleted: 3
  });

  const navigate = useNavigate();
  const handleLogout = () => {
  localStorage.removeItem('token');
  navigate('/login');
};


  const [notifications, setNotifications] = useState([
    { id: 1, message: "New grammar exercise available", time: "5 min ago", unread: true },
    { id: 2, message: "Class reminder: Business English starts in 30 min", time: "25 min ago", unread: true },
    { id: 3, message: "Great job completing yesterday's lesson!", time: "1 day ago", unread: false }
  ]);

  const joinVideoCall = (classId, className) => {
    // In a real app, this would open the video call interface
    alert(`Joining "${className}" video call... This would open your video conferencing platform.`);
    // You would typically redirect to a video call component or external service
  };

  const enrollInClass = (classId) => {
    setUpcomingClasses(prev => 
      prev.map(cls => 
        cls.id === classId ? { ...cls, enrolled: true } : cls
      )
    );
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'live':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></div>
            LIVE
          </span>
        );
      case 'starting-soon':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
            STARTING SOON
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">EL</span>
                  <button
                  onClick={handleLogout}
                  className="px-1 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                    Logout
                  </button>
                </div>
              </div>
              <div className="ml-10">
                <h1 className="text-xl font-semibold text-gray-900">English Learning Platform</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z" />
                  </svg>
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                    {notifications.filter(n => n.unread).length}
                  </span>
                </button>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.level} Level</p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {student.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">Welcome back, {student.name.split(' ')[0]}! 👋</h2>
              <p className="text-blue-100 mb-4">Ready to continue your English learning journey?</p>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{progress.streakDays}</div>
                  <div className="text-sm text-blue-100">Day Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{progress.completedLessons}</div>
                  <div className="text-sm text-blue-100">Lessons Done</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{Math.round((progress.completedLessons / progress.totalLessons) * 100)}%</div>
                  <div className="text-sm text-blue-100">Progress</div>
                </div>
              </div>
            </div>

            {/* Active Classes */}
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
                          {getStatusBadge(cls.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">👩‍🏫 {cls.teacher}</p>
                        <p className="text-sm text-gray-600 mb-1">🕒 {cls.time}</p>
                        <p className="text-sm text-gray-600 mb-3">📚 Topic: {cls.topic}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {cls.participants}/{cls.maxParticipants} participants
                        </div>
                      </div>
                      
                      <button
                        onClick={() => joinVideoCall(cls.id, cls.title)}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 ${
                          cls.status === 'live' 
                            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{cls.status === 'live' ? 'Join Live' : 'Join Call'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Classes */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Upcoming Classes</h3>
              
              <div className="space-y-4">
                {upcomingClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">{cls.title}</h4>
                      <p className="text-sm text-gray-600 mb-1">👩‍🏫 {cls.teacher}</p>
                      <p className="text-sm text-gray-600 mb-1">🕒 {cls.time}</p>
                      <p className="text-sm text-gray-600">📚 {cls.topic}</p>
                    </div>
                    
                    {cls.enrolled ? (
                      <div className="flex items-center text-green-600">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">Enrolled</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => enrollInClass(cls.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                      >
                        Enroll
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Progress Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Course Progress</span>
                    <span className="font-medium">{progress.completedLessons}/{progress.totalLessons}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.completedLessons / progress.totalLessons) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Weekly Goal</span>
                    <span className="font-medium">{progress.weeklyCompleted}/{progress.weeklyGoal}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-pink-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.weeklyCompleted / progress.weeklyGoal) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">🔥</span>
                  <div>
                    <p className="font-semibold text-gray-900">{progress.streakDays} Day Streak!</p>
                    <p className="text-sm text-gray-600">Keep it up!</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button className="w-full flex items-center p-3 text-left bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C20.168 18.477 18.582 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Practice Vocabulary</p>
                    <p className="text-sm text-gray-600">15 new words available</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center p-3 text-left bg-green-50 hover:bg-green-100 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Speaking Practice</p>
                    <p className="text-sm text-gray-600">Record & get feedback</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center p-3 text-left bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Grammar Quiz</p>
                    <p className="text-sm text-gray-600">Test your knowledge</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
              
              <div className="space-y-3">
                {notifications.slice(0, 3).map((notification) => (
                  <div key={notification.id} className={`p-3 rounded-xl ${notification.unread ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50'}`}>
                    <p className="text-sm font-medium text-gray-900 mb-1">{notification.message}</p>
                    <p className="text-xs text-gray-500">{notification.time}</p>
                  </div>
                ))}
              </div>
              
              <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium">
                View all notifications
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}