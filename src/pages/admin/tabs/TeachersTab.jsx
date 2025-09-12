import React, { useState } from "react";
import TeacherModal from "../modals/TeacherModal";
import TeacherTable from "../components/TeacherTable";

export default function TeachersTab() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [view, setView] = useState("active");
  const [activeSearch, setActiveSearch] = useState("");
  const [disabledSearch, setDisabledSearch] = useState("");

  // -------------------- Save Teacher --------------------
  const handleSaveTeacher = (teacherData) => {
    if (editIndex !== null) {
      const updated = [...teachers];
      updated[editIndex] = {
        ...teacherData,
        active: teachers[editIndex].active,
        salary: teachers[editIndex].salary ?? 0,
        ratePerClass: teachers[editIndex].ratePerClass ?? teacherData.ratePerClass,
      };
      setTeachers(updated);
      setEditIndex(null);
    } else {
      setTeachers([
        ...teachers,
        {
          ...teacherData,
          active: true,
          salary: 0,
        },
      ]);
    }
  };

  // -------------------- Edit / Delete / Toggle --------------------
  const handleEditTeacher = (index) => {
    setEditIndex(index);
    setIsModalOpen(true);
  };

  const handleDeleteTeacher = (index) => {
    if (window.confirm("Are you sure you want to delete this teacher?")) {
      const updated = [...teachers];
      updated.splice(index, 1);
      setTeachers(updated);
    }
  };

  const handleToggleAccess = (index) => {
    const updated = [...teachers];
    updated[index].active = !updated[index].active;
    setTeachers(updated);
  };

  // -------------------- Salary --------------------
  const handleMarkClass = (index) => {
    const updated = [...teachers];
    if (!updated[index]) return;
    const rate = updated[index].ratePerClass || 0;
    updated[index].salary = (updated[index].salary || 0) + rate;
    setTeachers(updated);
  };

  const handlePaySalary = (index) => {
    const updated = [...teachers];
    updated[index].salary = 0;
    setTeachers(updated);
  };

  // -------------------- Filters --------------------
  const activeTeachers = teachers.filter((t) => t.active);
  const disabledTeachers = teachers.filter((t) => !t.active);

  const filterTeachers = (list, term) =>
    list.filter(
      (t) =>
        t.firstName.toLowerCase().includes(term.toLowerCase()) ||
        t.lastName.toLowerCase().includes(term.toLowerCase()) ||
        (t.email && t.email.toLowerCase().includes(term.toLowerCase()))
    );

  const visibleActive = filterTeachers(activeTeachers, activeSearch);
  const visibleDisabled = filterTeachers(disabledTeachers, disabledSearch);

  // -------------------- Render --------------------
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-brand-primary">Teachers</h2>

      {/* Create Button */}
      <button
        onClick={() => {
          setEditIndex(null);
          setIsModalOpen(true);
        }}
        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary"
      >
        + Add Teacher
      </button>

      {/* Toggle Buttons */}
      <div className="flex justify-center gap-3 mt-6">
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
          className={`px-5 py-2 rounded-full font-medium transition-all duration-300 ${
            view === "disabled"
              ? "bg-red-600 text-white shadow-lg scale-105"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Disabled Teachers
        </button>
      </div>

      {/* === Active Tab === */}
      {view === "active" && (
        <>
          {/* Search Bar for Active */}
          <div className="mt-5 mb-5 flex justify-center">
            <div className="relative w-80">
              <input
                type="text"
                value={activeSearch}
                onChange={(e) => setActiveSearch(e.target.value)}
                placeholder="🔍 Search active teachers"
                className="w-full pl-10 pr-4 py-2 border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <span className="absolute left-3 top-2.5 text-gray-500">🔍</span>
            </div>
          </div>

          <h3 className="text-lg font-bold mb-2 text-green-600">Active Teachers</h3>
          <TeacherTable
            teachers={visibleActive}
            onEdit={handleEditTeacher}
            onDelete={handleDeleteTeacher}
            onToggle={handleToggleAccess}
            onMarkClass={handleMarkClass}
            onPaySalary={handlePaySalary}
          />
        </>
      )}

      {/* === Disabled Tab === */}
      {view === "disabled" && (
        <>
          {/* Search Bar for Disabled */}
          <div className="mt-5 mb-5 flex justify-center">
            <div className="relative w-80">
              <input
                type="text"
                value={disabledSearch}
                onChange={(e) => setDisabledSearch(e.target.value)}
                placeholder="🔍 Search disabled teachers"
                className="w-full pl-10 pr-4 py-2 border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <span className="absolute left-3 top-2.5 text-gray-500">🔍</span>
            </div>
          </div>

          <h3 className="text-lg font-bold mb-2 text-red-600">Disabled Teachers</h3>
          <TeacherTable
            teachers={visibleDisabled}
            onEdit={handleEditTeacher}
            onDelete={handleDeleteTeacher}
            onToggle={handleToggleAccess}
            onMarkClass={handleMarkClass}
            onPaySalary={handlePaySalary}
          />
        </>
      )}

      {/* Teacher Modal */}
      <TeacherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTeacher}
        initialData={editIndex !== null ? teachers[editIndex] : null}
      />
    </div>
  );
}
