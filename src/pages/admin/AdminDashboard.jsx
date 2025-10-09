import React, { useState, useEffect } from "react";
import OverviewTab from "./tabs/OverviewTab";
import TeachersTab from "./tabs/TeachersTab";
import StudentsTab from "./tabs/StudentsTab";
import ClassesTab from "./tabs/ClassesTab";
import ApplicationsTab from "./tabs/ApplicationsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import AssignStudentsTab from "./tabs/AssignStudentsTab";
import BookingsTab from "./tabs/BookingsTab";
import Header from "./ui/Header";
import {
  TrendingUp,
  Video,
  User,
  Calendar,
  Home,
  Bell,
  Users,
} from "lucide-react";
import { getTeachers } from "../../services/teacherService";
import { getStudents } from "../../services/studentService";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  
  // Load actual data from database
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load teachers and students on mount
  useEffect(() => {
    (async () => {
      try {
        const [teachersData, studentsData] = await Promise.all([
          getTeachers(),
          getStudents(),
        ]);
        setTeachers(teachersData);
        setStudents(studentsData);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNotify = (note) => {
    const fullNote =
      typeof note === "string"
        ? { message: note, date: new Date().toISOString() }
        : { ...note, date: note.date || new Date().toISOString() };

    setNotifications((prev) => [fullNote, ...prev]);
  };

  const renderTab = () => {
    if (loading && (activeTab === "assign")) {
      return <div className="p-6 text-gray-600">Loading...</div>;
    }

    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "teachers":
        return <TeachersTab onNotify={handleNotify} />;
      case "students":
        return <StudentsTab onNotify={handleNotify} />;
      case "classes":
        return <ClassesTab />;
      case "applications":
        return <ApplicationsTab />;
      case "notifications":
        return <NotificationsTab notifications={notifications} />;
      case "assign":
        return (
          <AssignStudentsTab
            teachers={teachers}
            students={students}
            onNotify={handleNotify}
          />
        );
      case "bookings":
        return <BookingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  const tabs = [
    { key: "overview", label: "Overview", icon: TrendingUp },
    { key: "teachers", label: "Teachers", icon: Video },
    { key: "students", label: "Students", icon: User },
    { key: "classes", label: "Classes", icon: Calendar },
    { key: "applications", label: "Applications", icon: Home },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "assign", label: "Assign Students", icon: Users },
    { key: "bookings", label: "Bookings", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-r from-violet-500 to-fuchsia-500">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">{renderTab()}</div>
      </div>
    </div>
  );
}