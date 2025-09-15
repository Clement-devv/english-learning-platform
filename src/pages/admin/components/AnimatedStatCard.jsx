import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const StatCard = ({ title, value, subtitle, icon: Icon, color = "#7C3AED" }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={reduced ? {} : { scale: 1.02 }}
      className="card-glass"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 rounded-full" style={{ backgroundColor: color + "22" }}>
          {Icon && <Icon className="h-6 w-6" style={{ color }} />}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
