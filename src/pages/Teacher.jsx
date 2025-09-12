import React, { useState, useEffect } from 'react';
import { Users, Calendar, Video, MessageSquare, BookOpen, Bell, Settings, Clock, Star, TrendingUp, Play, Eye } from 'lucide-react';

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [teacher, setTeacher] = useState({
    name: "Ms. Sarah Johnson",
    specialization: "English Conversation & Business English",
    rating: 4.9,
    totalStudents: 87,
    completedClasses: 342
  });

  const [liveClasses, setLiveClasses] = useState([
    {
      id: 1,
      title: "English Conversation - Beginner",
      time: "2:00 PM - 3:00 PM",
      participants: 8,
      maxParticipants: 12,
      status: "live",
      topic: "Daily Routines & Habits",
      students: ["John Doe", "Alice Smith", "Bob Wilson", "Carol Davis", "Emma Brown", "David Johnson", "Lisa Chen", "Mike Taylor"]
    }
  ]);

  const [upcomingClasses, setUpcomingClasses] = useState([
    {
      id: 2,
      title: "Business English",
      time: "4:00 PM - 5:00 PM",
      participants: 6,
      maxParticipants: 10,
      status: "starting-soon",
      topic: "Professional Presentations",
      students: ["John Doe", "Alice Smith", "Bob Wilson", "Carol Davis", "Emma Brown", "David Johnson"]
    },
    {
      id: 3,
      title: "Grammar Workshop",
      time: "Tomorrow 10:00 AM",
      participants: 5,
      maxParticipants: 8,
      status: "scheduled",
      topic: "Past Perfect Tense",
      students: ["John Doe", "Lisa Chen", "Mike Taylor", "Sarah Kim", "Tom Anderson"]
    },
    {
      id: 4,
      title: "Pronunciation Practice",
      time: "Friday 3:00 PM",
      participants: 3,
      maxParticipants: 6,
      status: "available",
      topic: "American vs British Accent",
      students: ["Alice Smith", "Bob Wilson", "Carol Davis"]
    }
  ]);

  const [bookingRequests, setBookingRequests] = useState([
    { id: 1, student: "John Doe", level: "Intermediate", requestedTime: "Monday 3:00 PM", topic: "Business English", status: "pending", message: "I need help with presentation skills for my job interview" },
    { id: 2, student: "Emma Brown", level: "Beginner", requestedTime: "Wednesday 2:00 PM", topic: "Conversation Practice", status: "pending", message: "Looking to improve daily conversation skills" },
    { id: 3, student: "David Wilson", level: "Advanced", requestedTime: "Friday 1:00 PM", topic: "IELTS Preparation", status: "pending", message: "Need help preparing for IELTS speaking test" }
  ]);

  const [studentProgress, setStudentProgress] = useState([
    { id: 1, name: "John Doe", level: "Intermediate", streak: 7, lessonsCompleted: 24, totalLessons: 40, lastActive: "2 hours ago", progress: 60, improvement: "+15%" },
    { id: 2, name: "Alice Smith", level: "Beginner", streak: 12, lessonsCompleted: 18, totalLessons: 30, lastActive: "1 day ago", progress: 60, improvement: "+22%" },
    { id: 3, name: "Emma Brown", level: "Intermediate", streak: 5, lessonsCompleted: 32, totalLessons: 45, lastActive: "3 hours ago", progress: 71, improvement: "+8%" },
    { id: 4, name: "David Wilson", level: "Advanced", streak: 15, lessonsCompleted: 28, totalLessons: 35, lastLessons: "1 hour ago", progress: 80, improvement: "+18%" }
  ]);

  const [todayStats, setTodayStats] = useState({
    scheduledClasses: 4,
    completedClasses: 2,
    totalStudents: 23,
    pendingBookings: 3,
    rating: 4.9,
    earnings: 240
  });

  const handleBookingAction = (bookingId, action) => {
    setBookingRequests(prev => 
      prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: action }
          : booking
      )
    );
    const booking = bookingRequests.find(b => b.id === bookingId);
    if (action === 'approved') {
      // Add to upcoming classes
      const newClass = {
        id: Date.now(),
        title: `${booking.topic} - ${booking.student}`,
        time: booking.requestedTime,
        participants: 1,
        maxParticipants: 1,
        status: 'scheduled',
        topic: booking.topic,
        students: [booking.student]
      };
      setUpcomingClasses(prev => [...prev, newClass]);
    }
  };

  const startVideoCall = (classId, className) => {
    alert(`Starting "${className}" video call... This would launch your teaching interface with whiteboard, screen sharing, and student management tools.`);
  };

  const viewStudentDashboard = (studentName) => {
    alert(`Connecting to ${studentName}'s dashboard... This would show their progress, assignments, and allow direct communication.`);
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
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            SCHEDULED
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            AVAILABLE
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
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-gray-900">English Learning Platform</h1>
                <p className="text-sm text-gray-500">Teacher Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                  <Bell className="w-6 h-6" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                    {bookingRequests.filter(b => b.status === 'pending').length}
                  </span>
                </button>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{teacher.name}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <Star className="w-3 h-3 text-yellow-400 mr-1" />
                    {teacher.rating} • {teacher.totalStudents} students
                  </div>
                </div>
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {teacher.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <nav className="flex space-x-8 mb-8">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: TrendingUp },
            { key: 'classes', label: 'My Classes', icon: Video },
            { key: 'students', label: 'Students', icon: Users },
            { key: 'bookings', label: 'Booking Requests', icon: Calendar }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              {key === 'bookings' && bookingRequests.filter(b => b.status === 'pending').length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {bookingRequests.filter(b => b.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">Good afternoon, {teacher.name.split(' ')[1]}! 🌟</h2>
              <p className="text-blue-100 mb-4">You have {todayStats.scheduledClasses} classes scheduled today</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{todayStats.completedClasses}</div>
                  <div className="text-sm text-blue-100">Classes Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{todayStats.totalStudents}</div>
                  <div className="text-sm text-blue-100">Active Students</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{todayStats.rating}</div>
                  <div className="text-sm text-blue-100">Avg Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">${todayStats.earnings}</div>
                  <div className="text-sm text-blue-100">Today's Earnings</div>
                </div>
              </div>
            </div>

            {/* Live Classes */}
            {liveClasses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                    Live Classes
                  </h3>
                </div>
                
                {liveClasses.map((cls) => (
                  <div key={cls.id} className="border border-red-200 rounded-xl p-5 bg-red-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-semibold text-gray-900">{cls.title}</h4>
                          {getStatusBadge(cls.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">📚 {cls.topic}</p>
                        <p className="text-sm text-gray-600">👥 {cls.participants} students joined</p>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => startVideoCall(cls.id, cls.title)}
                          className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors flex items-center space-x-2"
                        >
                          <Video className="w-5 h-5" />
                          <span>Join Live Class</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Bookings</p>
                    <p className="text-2xl font-bold text-gray-900">{bookingRequests.filter(b => b.status === 'pending').length}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Classes</p>
                    <p className="text-2xl font-bold text-gray-900">{teacher.completedClasses}</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Student Rating</p>
                    <p className="text-2xl font-bold text-gray-900 flex items-center">
                      {teacher.rating}
                      <Star className="w-5 h-5 text-yellow-400 ml-1" />
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-900">My Classes</h2>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Schedule New Class</span>
              </button>
            </div>

            <div className="space-y-4">
              {upcomingClasses.map((cls) => (
                <div key={cls.id} className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-semibold text-gray-900 text-lg">{cls.title}</h4>
                        {getStatusBadge(cls.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {cls.time}
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2" />
                          {cls.participants}/{cls.maxParticipants} students
                        </div>
                        <div className="flex items-center">
                          <BookOpen className="w-4 h-4 mr-2" />
                          {cls.topic}
                        </div>
                        <div className="flex items-center">
                          <Video className="w-4 h-4 mr-2" />
                          Video Call Ready
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      {cls.status === 'starting-soon' && (
                        <button
                          onClick={() => startVideoCall(cls.id, cls.title)}
                          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors flex items-center space-x-2"
                        >
                          <Video className="w-5 h-5" />
                          <span>Start Class</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {cls.students && cls.students.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Enrolled Students:</p>
                      <div className="flex flex-wrap gap-2">
                        {cls.students.map((student, index) => (
                          <button
                            key={index}
                            onClick={() => viewStudentDashboard(student)}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                          >
                            {student}
                            <Eye className="w-3 h-3 ml-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">Student Progress</h2>
            
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Active Students</h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {studentProgress.map((student) => (
                  <div key={student.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{student.name}</h4>
                          <p className="text-sm text-gray-600">{student.level} Level</p>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <span>🔥 {student.streak} day streak</span>
                            <span className="mx-2">•</span>
                            <span>Last active: {student.lastActive}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-4 mb-2">
                          <div className="text-center">
                            <p className="text-sm font-medium text-gray-900">{student.progress}%</p>
                            <p className="text-xs text-gray-500">Progress</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-green-600">{student.improvement}</p>
                            <p className="text-xs text-gray-500">Improvement</p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => viewStudentDashboard(student.name)}
                          className="inline-flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Dashboard
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Lessons Completed</span>
                        <span className="font-medium">{student.lessonsCompleted}/{student.totalLessons}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${student.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-900">Booking Requests</h2>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {bookingRequests.filter(b => b.status === 'pending').length} pending
              </span>
            </div>
            
            <div className="space-y-4">
              {bookingRequests.map((booking) => (
                <div key={booking.id} className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${
                  booking.status === 'pending' ? 'border-yellow-400' : 
                  booking.status === 'approved' ? 'border-green-400' : 'border-red-400'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {booking.student.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{booking.student}</h4>
                          <p className="text-sm text-gray-600">{booking.level} Level</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          booking.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Requested Time:</p>
                          <p className="font-medium">{booking.requestedTime}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Topic:</p>
                          <p className="font-medium">{booking.topic}</p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600 mb-1">Student Message:</p>
                        <p className="text-sm text-gray-900">{booking.message}</p>
                      </div>
                    </div>
                    
                    {booking.status === 'pending' && (
                      <div className="flex space-x-3 ml-4">
                        <button
                          onClick={() => handleBookingAction(booking.id, 'approved')}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleBookingAction(booking.id, 'declined')}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;