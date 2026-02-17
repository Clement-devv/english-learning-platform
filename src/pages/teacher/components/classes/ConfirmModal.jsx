// src/pages/teacher/components/classes/ConfirmModal.jsx 
import React from "react";
import { AlertTriangle, Trash2, XCircle } from "lucide-react";

export default function ConfirmModal({ isOpen, type, onConfirm, onCancel, isDarkMode }) {
  if (!isOpen) return null;

  const config = {
    delete: {
      title: "Delete Class",
      message: "Are you sure you want to delete this class? This action cannot be undone.",
      confirmText: "Delete",
      confirmClass: "bg-red-600 hover:bg-red-700",
      icon: Trash2,
      iconColor: "text-red-500"
    },
    cancel: {
      title: "Cancel Class",
      message: "Are you sure you want to cancel this class? Students will be notified.",
      confirmText: "Cancel Class",
      confirmClass: "bg-yellow-600 hover:bg-yellow-700",
      icon: XCircle,
      iconColor: "text-yellow-500"
    }
  };

  const currentConfig = config[type] || config.delete;
  const Icon = currentConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } rounded-2xl shadow-2xl w-full max-w-md border-2 overflow-hidden transform transition-all`}>
        
        {/* Header with icon */}
        <div className={`${
          isDarkMode ? 'bg-gray-750' : 'bg-gray-50'
        } p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`${
              isDarkMode ? 'bg-gray-700' : 'bg-white'
            } p-3 rounded-full`}>
              <Icon className={`w-6 h-6 ${currentConfig.iconColor}`} />
            </div>
            <h3 className={`text-xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {currentConfig.title}
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className={`flex items-start gap-3 p-4 rounded-lg ${
            isDarkMode ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'
          } border mb-6`}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
            }`} />
            <p className={`text-sm ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {currentConfig.message}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              No, Keep It
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-6 py-3 ${currentConfig.confirmClass} text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl`}
            >
              {currentConfig.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
