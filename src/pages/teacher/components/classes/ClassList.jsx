// src/pages/teacher/components/classes/ClassList.jsx
import React from "react";
import { motion } from "framer-motion";
import ClassItem from "./ClassItem";

export default function ClassList({ data, onJoin, onDelete }) {
  if (!data || data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 bg-white rounded-lg shadow-md"
      >
        <p className="text-gray-500 text-lg">No classes scheduled yet.</p>
        <p className="text-gray-400 text-sm mt-2">
          Accept booking requests or create a new class to get started
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid gap-4"
    >
      {data.map((cls, index) => (
        <motion.div
          key={cls.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <ClassItem 
            item={cls} 
            onJoin={onJoin}
            onDelete={onDelete} 
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
