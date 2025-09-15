import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function AnimatedButton({ children, className = "", whileHover = { y: -3 }, whileTap = { scale: 0.97 }, ...props }) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.button
      whileHover={shouldReduce ? {} : whileHover}
      whileTap={shouldReduce ? {} : whileTap}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
      className={`btn-primary ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
