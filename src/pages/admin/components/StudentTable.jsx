// src/pages/admin/components/StudentTable.jsx
import React from "react";
import { visibleEmail } from "../../../utils/managedStudent.js";
import { useTranslation } from "react-i18next";

export default function StudentTable({
  students,
  onEdit,
  onDelete,
  onToggle,
  onManualPayment,
  onViewPayment,
  onViewLessons,
  onMarkLesson,
  onUnmarkLesson,   // ← NEW
  onCopyPassword,
  onResetPassword,
}) {
  const { t: tr } = useTranslation("admin");
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse border border-stone-300">
        <thead>
          <tr className="bg-stone-100 text-left">
            <th className="border p-2">{tr("studentTable.firstName")}</th>
            <th className="border p-2">{tr("studentTable.surname")}</th>
            <th className="border p-2">{tr("studentTable.email")}</th>
            <th className="border p-2">{tr("studentTable.password")}</th>
            <th className="border p-2">{tr("studentTable.noOfClasses")}</th>
            <th className="border p-2">{tr("studentTable.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center p-4 text-stone-500">
                {tr("studentTable.noStudentsFound")}
              </td>
            </tr>
          ) : (
            students.map((s) => (
              <tr key={s._id} className="hover:bg-stone-50">
                <td className="border p-2">{s.firstName}</td>
                <td className="border p-2">{s.lastName}</td>
                <td className="border p-2">{visibleEmail(s.email) || tr("studentTable.noLoginManaged")}</td>

                {/* Password column */}
                <td className="border p-2">
                  {s.showTempPassword && s.tempPassword ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-stone-100 px-2 py-1 rounded text-sm">
                        {s.tempPassword}
                      </span>
                      <button
                        onClick={() => onCopyPassword(s._id)}
                        className="px-2 py-1 text-xs bg-ad-accent text-white rounded hover:bg-ad-accent-hover"
                      >
                        {tr("studentTable.copy")}
                      </button>
                    </div>
                  ) : (
                    <span className="italic text-stone-400 text-sm">••••••••</span>
                  )}
                  <div className="mt-1">
                    <button
                      onClick={() => onResetPassword(s._id)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      {tr("studentTable.resetPassword")}
                    </button>
                  </div>
                </td>

                {/* Classes */}
                <td className="border p-2 text-center">{s.classCredits ?? 0}</td>

                {/* Actions */}
                <td className="border p-2">
                  <div className="flex flex-wrap gap-2">

                    {/* ✅ Mark Lesson */}
                    <button
                      onClick={() => onMarkLesson(s._id)}
                      className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs"
                    >
                      {tr("studentTable.markLesson")}
                    </button>

                    {/* ✅ NEW: Unmark Lesson */}
                    <button
                      onClick={() => onUnmarkLesson(s._id)}
                      className="px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 text-xs"
                    >
                      {tr("studentTable.unmarkLesson")}
                    </button>

                    <button
                      onClick={() => onManualPayment(s._id)}
                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                    >
                      {tr("studentTable.manualPayment")}
                    </button>

                    <button
                      onClick={() => onViewPayment(s._id)}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                    >
                      {tr("studentTable.viewPayment")}
                    </button>

                    <button
                      onClick={() => onViewLessons(s._id)}
                      className="px-2 py-1 bg-ad-accent text-white rounded hover:bg-ad-accent-hover text-xs"
                    >
                      {tr("studentTable.viewLessons")}
                    </button>

                    <button
                      onClick={() => onEdit(s._id)}
                      className="px-2 py-1 bg-ad-accent text-white rounded hover:bg-ad-accent-hover text-xs"
                    >
                      {tr("studentTable.edit")}
                    </button>

                    <button
                      onClick={() => onDelete(s._id)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                    >
                      {tr("studentTable.delete")}
                    </button>

                    <button
                      onClick={() => onToggle(s._id, !s.active)}
                      className={`px-2 py-1 text-xs rounded text-white ${
                        s.active
                          ? "bg-stone-500 hover:bg-stone-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {s.active ? tr("studentTable.disable") : tr("studentTable.enable")}
                    </button>

                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
