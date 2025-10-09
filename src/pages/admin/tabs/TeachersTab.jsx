import React, { useState, useEffect } from "react";
import api from "../../../api"; // make sure api.js exports an axios instance
import TeacherTable from "../components/TeacherTable";
import TeacherModal from "../modals/TeacherModal";
import AnimatedButton from "../components/AnimatedButton";

export default function TeacherTab({ onNotify }) {
  const [teachers, setTeachers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [view, setView] = useState("active");
  const [searchActive, setSearchActive] = useState("");
  const [searchDisabled, setSearchDisabled] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ NEW: continent filter state (empty = all)
  const [continentFilter, setContinentFilter] = useState("");

  // ---------------------------
  // Load teachers from backend
  // ---------------------------
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoading(true);
      try {
        console.log("Fetching teachers from API..."); // Debug log
        const res = await api.get("/api/teachers"); // Fixed: Added /api prefix
        console.log("Teachers fetched successfully:", res.data); // Debug log
        setTeachers(res.data);
      } catch (err) {
        console.error("Error fetching teachers:", err);
        console.error("Error response:", err.response?.data); // More detailed error
        console.error("Error status:", err.response?.status); // Status code
        setToast(`Could not load teachers: ${err.response?.data?.message || err.message}`);
        setTimeout(() => setToast(""), 5000); // Longer display time
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, []);

  // ---------------------------
  // Save Teacher (create/update)
  // ---------------------------
  const handleSaveTeacher = async (teacherData) => {
    try {
      console.log("Saving teacher data:", teacherData); // Debug log
      
      if (editIndex !== null) {
        const id = teachers[editIndex]._id;
        console.log("Updating teacher with ID:", id); // Debug log
        const res = await api.put(`/api/teachers/${id}`, teacherData); // Fixed: Added /api prefix
        setTeachers((prev) =>
          prev.map((t, i) => (i === editIndex ? res.data : t))
        );
        onNotify?.(`Teacher updated: ${teacherData.firstName} ${teacherData.lastName}`);
        setToast(`Teacher ${teacherData.firstName} ${teacherData.lastName} updated successfully!`);
      } else {
        console.log("Creating new teacher..."); // Debug log
        const res = await api.post("/api/teachers", teacherData); // Fixed: Added /api prefix
        console.log("Teacher created:", res.data); // Debug log
        setTeachers((prev) => [...prev, res.data]);
        onNotify?.(`New teacher created: ${teacherData.firstName} ${teacherData.lastName}`);
        setToast(`Teacher ${teacherData.firstName} ${teacherData.lastName} created successfully!`);
      }
      
      setIsModalOpen(false);
      setEditIndex(null);
      setTimeout(() => setToast(""), 3000);
      
    } catch (err) {
      console.error("Save error:", err);
      console.error("Save error response:", err.response?.data); // More detailed error
      console.error("Save error status:", err.response?.status); // Status code
      
      let errorMessage = "Failed to save teacher";
      if (err.response?.data?.message) {
        errorMessage += `: ${err.response.data.message}`;
      } else if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      
      setToast(errorMessage);
      setTimeout(() => setToast(""), 5000); // Longer display time for errors
    }
  };

  // ---------------------------
  // Edit / Delete / Toggle
  // ---------------------------
  const handleEdit = (index) => {
    setEditIndex(index);
    setIsModalOpen(true);
  };

  const handleDelete = async (index) => {
    const teacher = teachers[index];
    if (!teacher || !window.confirm("Delete this teacher?")) return;
    
    try {
      console.log("Deleting teacher with ID:", teacher._id); // Debug log
      await api.delete(`/api/teachers/${teacher._id}`); // Fixed: Added /api prefix
      setTeachers((prev) => prev.filter((_, i) => i !== index));
      setToast(`Teacher ${teacher.firstName} ${teacher.lastName} deleted successfully!`);
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      console.error("Delete error:", err);
      console.error("Delete error response:", err.response?.data); // More detailed error
      
      let errorMessage = "Could not delete teacher";
      if (err.response?.data?.message) {
        errorMessage += `: ${err.response.data.message}`;
      }
      
      setToast(errorMessage);
      setTimeout(() => setToast(""), 5000);
    }
  };

  const handleToggle = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;
    
    try {
      console.log("Toggling teacher status for ID:", teacher._id); // Debug log
      const res = await api.put(`/api/teachers/${teacher._id}`, { // Fixed: Added /api prefix
        active: !teacher.active,
      });
      setTeachers((prev) =>
        prev.map((t, i) => (i === index ? res.data : t))
      );
      
      const status = !teacher.active ? "activated" : "deactivated";
      setToast(`Teacher ${teacher.firstName} ${teacher.lastName} ${status}!`);
      setTimeout(() => setToast(""), 3000);
      
    } catch (err) {
      console.error("Toggle error:", err);
      console.error("Toggle error response:", err.response?.data); // More detailed error
      
      setToast("Could not update teacher status");
      setTimeout(() => setToast(""), 3000);
    }
  };

  // ---------------------------
  // Lesson & Payment (with backend sync)
  // ---------------------------
  const handleMarkLesson = async (index) => {
    const teacher = teachers[index];
    if (!teacher) return;

    try {
      const updatedLessons = (teacher.lessonsCompleted || 0) + 1;
      const rate = parseFloat(teacher.ratePerClass || 0);
      const updatedEarned = (teacher.earned || 0) + rate;

      // Update backend
      const res = await api.put(`/api/teachers/${teacher._id}`, {
        lessonsCompleted: updatedLessons,
        earned: updatedEarned,
      });

      // Update frontend
      setTeachers((prev) =>
        prev.map((t, i) => (i === index ? res.data : t))
      );

      setToast(`Lesson marked for ${teacher.firstName}! Earned: $${rate}`);
      setTimeout(() => setToast(""), 3000);
      
    } catch (err) {
      console.error("Mark lesson error:", err);
      setToast("Could not mark lesson");
      setTimeout(() => setToast(""), 3000);
    }
  };

  const handlePayTeacher = async (index) => {
    const teacher = teachers[index];
    if (!teacher || teacher.earned <= 0) {
      setToast("No payment due for this teacher");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    if (!window.confirm(`Pay ${teacher.firstName} ${teacher.lastName} $${teacher.earned}?`)) {
      return;
    }

    try {
      // Reset earned and lessons on backend
      const res = await api.put(`/api/teachers/${teacher._id}`, {
        earned: 0,
        lessonsCompleted: 0,
      });

      // Update frontend
      setTeachers((prev) =>
        prev.map((t, i) => (i === index ? res.data : t))
      );

      setToast(`Salary of $${teacher.earned} paid to ${teacher.firstName}!`);
      setTimeout(() => setToast(""), 3000);
      
    } catch (err) {
      console.error("Pay teacher error:", err);
      setToast("Could not process payment");
      setTimeout(() => setToast(""), 3000);
    }
  };

  // ---------------------------
  // Password actions (with backend sync)
  // ---------------------------
  // Replace the handleResetPassword function in your TeacherTab.jsx with this:

const handleResetPassword = async (index) => {
  const teacher = teachers[index];
  if (!teacher) return;

  try {
    // Generate a new random password
    const newPass = Math.random().toString(36).slice(-8);
    
    // Send the plain password to backend - backend will hash it
    const res = await api.put(`/api/teachers/${teacher._id}`, {
      password: newPass,
    });

    // Backend returns the teacher data with temporaryPassword field
    const updated = [...teachers];
    updated[index] = { 
      ...res.data, 
      password: newPass, // Store plain password temporarily for display
      showTempPassword: true 
    };
    setTeachers(updated);
    
    setToast("Password reset successfully!");
    setTimeout(() => setToast(""), 2000);
    
    // Hide temp password after 10 seconds
    setTimeout(() => {
      setTeachers(prev => 
        prev.map((t, i) => 
          i === index ? { ...t, showTempPassword: false, password: undefined } : t
        )
      );
    }, 10000);

    // Log for admin to email the teacher
    console.log(`📧 Email this to ${teacher.email}:`);
    console.log(`Your new password is: ${newPass}`);
    console.log(`Please login at: http://yourapp.com/teacher/login`);
    
  } catch (err) {
    console.error("Reset password error:", err);
    setToast("Could not reset password");
    setTimeout(() => setToast(""), 3000);
  }
};
  const handleCopyPassword = (index) => {
    if (navigator.clipboard && teachers[index]?.password) {
      navigator.clipboard.writeText(teachers[index].password);
      setToast("Password copied to clipboard!");
      setTimeout(() => setToast(""), 2000);
      
      // Hide temp password
      setTeachers(prev => 
        prev.map((t, i) => 
          i === index ? { ...t, showTempPassword: false } : t
        )
      );
    }
  };

  // ---------------------------
  // Filters
  // ---------------------------
  const activeTeachers = teachers.filter((t) => t.active);
  const disabledTeachers = teachers.filter((t) => !t.active);

  // include continent filter together with name search
  const filteredActive = activeTeachers.filter((t) =>
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchActive.toLowerCase())
    && (continentFilter === "" || t.continent === continentFilter)
  );
  const filteredDisabled = disabledTeachers.filter((t) =>
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchDisabled.toLowerCase())
    && (continentFilter === "" || t.continent === continentFilter)
  );

  return (
    <div className="relative p-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-white max-w-sm ${
          toast.includes('successfully') || toast.includes('paid') || toast.includes('copied') 
            ? 'bg-green-500' 
            : toast.includes('Error') || toast.includes('Failed') || toast.includes('Could not')
            ? 'bg-red-500'
            : 'bg-blue-500'
        }`}>
          {toast}
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4 text-brand-primary">Teachers</h2>

      <div className="flex gap-3">
        <AnimatedButton
          color="primary"
          onClick={() => {
            setEditIndex(null);
            setIsModalOpen(true);
          }}
        >
          + Add Teacher
        </AnimatedButton>
      </div>

      {/* Toggle view */}
      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={() => setView("active")}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
            view === "active"
              ? "bg-green-600 text-white shadow-lg scale-105"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Active Teachers ({filteredActive.length})
        </button>
        <button
          onClick={() => setView("disabled")}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
            view === "disabled"
              ? "bg-red-600 text-white shadow-lg scale-105"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Disabled Teachers ({filteredDisabled.length})
        </button>
      </div>

      {loading && (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2">Loading teachers...</p>
        </div>
      )}

      {/* Active teachers */}
      {!loading && view === "active" && (
        <div className="mt-6">
          <div className="mb-4 flex justify-center gap-4">
            <input
              type="text"
              placeholder="Search active teachers..."
              value={searchActive}
              onChange={(e) => setSearchActive(e.target.value)}
              className="w-80 px-4 py-2 rounded-full border shadow focus:ring focus:ring-green-300"
            />

            {/* ✅ Continent filter select */}
            <select
              value={continentFilter}
              onChange={(e) => setContinentFilter(e.target.value)}
              className="px-4 py-2 rounded-full border shadow"
            >
              <option value="">All Continents</option>
              <option value="Africa">Africa</option>
              <option value="Europe">Europe</option>
              <option value="Asia">Asia</option>
            </select>
          </div>

          {filteredActive.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchActive ? "No active teachers found matching your search." : "No active teachers found."}
            </div>
          ) : (
            <TeacherTable
              teachers={filteredActive}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onMarkLesson={handleMarkLesson}
              onPay={handlePayTeacher}
              onCopyPassword={handleCopyPassword}
              onResetPassword={handleResetPassword}
            />
          )}
        </div>
      )}

      {/* Disabled teachers */}
      {!loading && view === "disabled" && (
        <div className="mt-6">
          <div className="mb-4 flex justify-center gap-4">
            <input
              type="text"
              placeholder="Search disabled teachers..."
              value={searchDisabled}
              onChange={(e) => setSearchDisabled(e.target.value)}
              className="w-80 px-4 py-2 rounded-full border shadow focus:ring focus:ring-red-300"
            />

            {/* ✅ Continent filter select (same state, applies to both views) */}
            <select
              value={continentFilter}
              onChange={(e) => setContinentFilter(e.target.value)}
              className="px-4 py-2 rounded-full border shadow"
            >
              <option value="">All Continents</option>
              <option value="Africa">Africa</option>
              <option value="Europe">Europe</option>
              <option value="Asia">Asia</option>
            </select>
          </div>

          {filteredDisabled.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchDisabled ? "No disabled teachers found matching your search." : "No disabled teachers found."}
            </div>
          ) : (
            <TeacherTable
              teachers={filteredDisabled}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onMarkLesson={handleMarkLesson}
              onPay={handlePayTeacher}
              onCopyPassword={handleCopyPassword}
              onResetPassword={handleResetPassword}
            />
          )}
        </div>
      )}

      <TeacherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTeacher}
        initialData={editIndex !== null ? teachers[editIndex] : null}
      />
    </div>
  );
}
