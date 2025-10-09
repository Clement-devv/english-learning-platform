// src/pages/student/Welcome.jsx

import React from "react";
import { Smile } from "lucide-react";

export default function WelcomeSection({ studentName = "Student" }) {
  const today = new Date();
  const hours = today.getHours();

  let greeting = "Hello";
  if (hours < 12) greeting = "Good Morning";
  else if (hours < 18) greeting = "Good Afternoon";
  else greeting = "Good Evening";

  const dateString = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6 flex items-center justify-between shadow-md">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">
          {greeting}, {studentName}! 👋
        </h1>
        <p className="text-sm sm:text-base mt-1 opacity-90">
          Welcome back! Let’s make today a productive learning day.
        </p>
        <p className="text-xs sm:text-sm mt-2 opacity-80">{dateString}</p>
      </div>
      <Smile className="hidden sm:block w-12 h-12 opacity-80" />
    </div>
  );
}
