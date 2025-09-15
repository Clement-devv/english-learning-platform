import React, { useState } from "react";
import TeacherTable from "../components/TeacherTable";
import TeacherModal from "../modals/TeacherModal";
import AnimatedButton from "../components/AnimatedButton";

export default function TeacherTab() {
  const [teachers, setTeachers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [view, setView] = useState("active");
  const [searchActive, setSearchActive] = useState("");
  const [searchDisabled, setSearchDisabled] = useState("");
  const [toast, setToast] = useState("");

  // ---------------------------
  // Save Teacher
  // ---------------------------
  const handleSaveTeacher = (teacherData) => {
  // Check if email already used (only when adding new teacher)
  if (
    editIndex === null &&
    teachers.some(
      (t) => t.email.toLowerCase() === teacherData.email.toLowerCase()
    )
  ) {
    setToast("Email already in use by another teacher.");
    setTimeout(() => setToast(""), 3000);
    return;
  }

  const generatedPassword =
    teacherData.password && teacherData.password.trim() !== ""
      ? teacherData.password
      : Math.random().toString(36).slice(-8);

  if (editIndex !== null) {
    const updated = [...teachers];
    updated[editIndex] = {
      ...teacherData,
      password: generatedPassword,
      active: teachers[editIndex].active,
      earned: teachers[editIndex].earned,
      lessonsCompleted: teachers[editIndex].lessonsCompleted,
    };
    setTeachers(updated);
    setEditIndex(null);
  } else {
    setTeachers([
      ...teachers,
      {
        ...teacherData,
        password: generatedPassword,
        active: true,
        lessonsCompleted: 0,
        earned: 0,
        showTempPassword: true,
      },
    ]);
  }
  setIsModalOpen(false);
};

  // ---------------------------
  // Edit / Delete / Toggle
  // ---------------------------
  const handleEdit = (index) => {
    setEditIndex(index);
    setIsModalOpen(true);
  };

  const handleDelete = (index) => {
    if (window.confirm("Delete this teacher?")) {
      const updated = [...teachers];
      updated.splice(index, 1);
      setTeachers(updated);
    }
  };

  const handleToggle = (index) => {
    const updated = [...teachers];
    updated[index].active = !updated[index].active;
    setTeachers(updated);
  };

  // ---------------------------
  // Lesson & Payment
  // ---------------------------
  const handleMarkLesson = (index) => {
    const updated = [...teachers];
    if (!updated[index]) return;
    updated[index].lessonsCompleted =
      (updated[index].lessonsCompleted || 0) + 1;

    const rate = parseFloat(updated[index].ratePerClass || 0);
    updated[index].earned = (updated[index].earned || 0) + rate;
    setTeachers(updated);
  };


  const handlePayTeacher = (index) => {
  const teacher = teachers[index];
  if (!teacher) return;

  // Ask for confirmation
  const confirmed = window.confirm(
    `Are you sure you want to pay ${teacher.firstName} ${teacher.lastName} a salary of $${teacher.earned}?`
  );

  if (!confirmed) return;

  // Reset salary & lessons
  const updated = [...teachers];
  updated[index] = {
    ...teacher,
    earned: 0,
    lessonsCompleted: 0,
  };
  setTeachers(updated);

  // Send email
  sendEmail(
    teacher.email,
    `Hi ${teacher.firstName},\n\nYour salary of $${teacher.earned} has been paid.\n\nThank you for your great work!`
  );

  // Show toast
  setToast(`Salary of $${teacher.earned} paid to ${teacher.firstName}`);
  setTimeout(() => setToast(""), 3000);
};



  // ---------------------------
  // Password actions
  // ---------------------------
  const handleResetPassword = (index) => {
    const updated = [...teachers];
    const newPass = Math.random().toString(36).slice(-8);
    updated[index].password = newPass;
    updated[index].showTempPassword = true;
    setTeachers(updated);

    setToast("Password reset!");
    setTimeout(() => setToast(""), 2000);

    // hide after 5s
    setTimeout(() => {
      const again = [...updated];
      if (again[index]) again[index].showTempPassword = false;
      setTeachers(again);
    }, 5000);

    console.log(
      `Email sent to ${updated[index].email}: Your new password is ${newPass}`
    );
  };

  const handleCopyPassword = (index) => {
    if (navigator.clipboard && teachers[index]?.password) {
      navigator.clipboard.writeText(teachers[index].password);
      setToast("Password copied!");
      setTimeout(() => setToast(""), 2000);

      const updated = [...teachers];
      updated[index].showTempPassword = false;
      setTeachers(updated);
    }
  };

  // ---------------------------
  // Filters
  // ---------------------------
  const activeTeachers = teachers.filter((t) => t.active);
  const disabledTeachers = teachers.filter((t) => !t.active);

  const filteredActive = activeTeachers.filter((t) =>
    `${t.firstName} ${t.lastName}`
      .toLowerCase()
      .includes(searchActive.toLowerCase())
  );

  const filteredDisabled = disabledTeachers.filter((t) =>
    `${t.firstName} ${t.lastName}`
      .toLowerCase()
      .includes(searchDisabled.toLowerCase())
  );

  return (
    <div className="relative p-4">
        {toast && (
  <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded shadow">
    {toast}
  </div>
)}

      <h2 className="text-2xl font-bold mb-4 text-brand-primary">Teachers</h2>

      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

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
          Active Teachers
        </button>
        <button
          onClick={() => setView("disabled")}
          className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${
            view === "disabled"
              ? "bg-red-600 text-white shadow-lg scale-105"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Disabled Teachers
        </button>
      </div>

      {/* Active teachers */}
      {view === "active" && (
        <div className="mt-6">
          <div className="mb-4 flex justify-center">
            <input
              type="text"
              placeholder="Search active teachers..."
              value={searchActive}
              onChange={(e) => setSearchActive(e.target.value)}
              className="w-80 px-4 py-2 rounded-full border shadow focus:ring focus:ring-green-300"
            />
          </div>

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
        </div>
      )}

      {/* Disabled teachers */}
      {view === "disabled" && (
        <div className="mt-6">
          <div className="mb-4 flex justify-center">
            <input
              type="text"
              placeholder="Search disabled teachers..."
              value={searchDisabled}
              onChange={(e) => setSearchDisabled(e.target.value)}
              className="w-80 px-4 py-2 rounded-full border shadow focus:ring focus:ring-red-300"
            />
          </div>

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
