import React, { useState } from "react";
import OverviewTab from "./tabs/OverviewTab";
import TeachersTab from "./tabs/TeachersTab";
import StudentsTab from "./tabs/StudentsTab";
import ClassesTab from "./tabs/ClassesTab";
import ApplicationsTab from "./tabs/ApplicationsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import AssignStudentsTab from "./tabs/AssignStudentsTab";
import Header from "./ui/Header";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab />;
      case "teachers": return <TeachersTab />;
      case "students": return <StudentsTab />;
      case "classes": return <ClassesTab />;
      case "applications": return <ApplicationsTab />;
      case "notifications": return <NotificationsTab />;
      case "AssignStudents": return <AssignStudentsTab/>
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab Buttons */}
        <div className="flex space-x-4 mb-6">
          {["overview", "teachers", "students", "classes", "applications", "notifications", "Assign-students"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab ? "bg-purple-600 text-white" : "bg-gray-200"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow-md rounded-lg p-6">
          {renderTab()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
