// src/pages/admin/components/TeacherTable.jsx
import React, { useState } from "react";
import { useCurrencySymbol } from "../../../hooks/useCurrencySymbol";
import { useTranslation } from "react-i18next";

export default function TeacherTable({
  teachers,
  onEdit,
  onDelete,
  onToggle,
  onMarkLesson,
  onUnmarkLesson,   // ← NEW
  onPay,
  onCopyPassword,
  onResetPassword,
}) {
  const { t: tr } = useTranslation("admin");
  const sym = useCurrencySymbol();
  const [continentFilter, setContinentFilter] = useState("All");

  const filteredTeachers =
    continentFilter === "All"
      ? teachers
      : teachers.filter((t) => t.continent === continentFilter);

  const totalSalary = filteredTeachers.reduce(
    (acc, t) => acc + (t.earned || 0),
    0
  );

  return (
    <div className="mt-4 overflow-x-auto">
      {/* Continent Filter */}
      <div className="mb-3 flex items-center gap-3">
        <label className="font-medium">{tr("teacherTable.filterByContinent")}</label>
        <select
          value={continentFilter}
          onChange={(e) => setContinentFilter(e.target.value)}
          className="border px-3 py-1 rounded shadow-sm"
        >
          <option value="All">{tr("teacherTable.all")}</option>
          <option value="Africa">{tr("teacherTable.africa")}</option>
          <option value="Asia">{tr("teacherTable.asia")}</option>
          <option value="Europe">{tr("teacherTable.europe")}</option>
        </select>
      </div>

      <table className="w-full border-collapse border border-gray-300 shadow-sm text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">{tr("teacherTable.first")}</th>
            <th className="border p-2">{tr("teacherTable.last")}</th>
            <th className="border p-2">{tr("teacherTable.email")}</th>
            <th className="border p-2">{tr("teacherTable.rate", { sym })}</th>
            <th className="border p-2">{tr("teacherTable.lessons")}</th>
            <th className="border p-2">{tr("teacherTable.earned", { sym })}</th>
            <th className="border p-2">{tr("teacherTable.continent")}</th>
            <th className="border p-2">{tr("teacherTable.password")}</th>
            <th className="border p-2">{tr("teacherTable.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {filteredTeachers.length === 0 ? (
            <tr>
              <td colSpan="9" className="text-center p-4 text-gray-500 italic">
                {tr("teacherTable.noTeachersFound")}
              </td>
            </tr>
          ) : (
            filteredTeachers.map((t, i) => (
              <tr key={t._id || i} className="hover:bg-gray-50 transition">
                <td className="border p-2">{t.firstName}</td>
                <td className="border p-2">{t.lastName}</td>
                <td className="border p-2">{t.email}</td>
                <td className="border p-2 text-center">{t.ratePerClass}</td>
                <td className="border p-2 text-center">{t.lessonsCompleted || 0}</td>
                <td className="border p-2 text-center">{sym}{(t.earned || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="border p-2 text-center">{t.continent || "—"}</td>

                {/* Password column */}
                <td className="border p-2 text-center">
                  {t.showTempPassword ? (
                    <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs">
                      {t.password}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">{tr("teacherTable.hidden")}</span>
                  )}
                </td>

                {/* Actions */}
                <td className="border p-1">
                  <div className="flex flex-wrap gap-1 justify-center text-xs">

                    <button
                      onClick={() => onEdit(i)}
                      className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      {tr("teacherTable.edit")}
                    </button>

                    <button
                      onClick={() => onDelete(i)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      {tr("teacherTable.delete")}
                    </button>

                    <button
                      onClick={() => onToggle(i)}
                      className={`px-2 py-1 rounded text-white ${
                        t.active ? "bg-gray-500 hover:bg-gray-600" : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {t.active ? tr("teacherTable.disable") : tr("teacherTable.enable")}
                    </button>

                    {/* ✅ Mark Lesson */}
                    <button
                      onClick={() => onMarkLesson(i)}
                      className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      {tr("teacherTable.mark")}
                    </button>

                    {/* ✅ NEW: Unmark Lesson */}
                    <button
                      onClick={() => onUnmarkLesson(i)}
                      className="px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700"
                    >
                      {tr("teacherTable.unmark")}
                    </button>

                    <button
                      onClick={() => onPay(i)}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      {tr("teacherTable.paid")}
                    </button>

                    {t.password && (
                      <>
                        <button
                          onClick={() => onCopyPassword(i)}
                          className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                        >
                          {tr("teacherTable.copy")}
                        </button>
                        <button
                          onClick={() => onResetPassword(i)}
                          className="px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                        >
                          {tr("teacherTable.reset")}
                        </button>
                      </>
                    )}

                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Total salary footer */}
      {filteredTeachers.length > 0 && (
        <div className="mt-3 text-right pr-2 text-gray-700 font-semibold">{tr("teacherTable.totalSalaries", { sym, value: totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
        </div>
      )}
    </div>
  );
}
