// src/components/DarkModeToggle.jsx - Reusable Component
import { Sun, Moon } from 'lucide-react';

export default function DarkModeToggle({ isDarkMode, onToggle, className = "" }) {
  return (
    <button
      onClick={onToggle}
      className={`p-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
          : 'bg-gradient-to-r from-indigo-600 to-purple-600'
      } text-white ${className}`}
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
    </button>
  );
}
