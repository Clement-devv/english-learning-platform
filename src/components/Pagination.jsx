// src/components/Pagination.jsx
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Reusable pagination bar.
 *
 * Props:
 *   page        — current 1-based page number
 *   totalPages  — total number of pages
 *   total       — total record count (for "Showing X–Y of Z")
 *   pageSize    — records per page
 *   onPage      — callback(newPage)
 *   isDarkMode  — optional dark mode flag
 */
export default function Pagination({ page, totalPages, total, pageSize, onPage, isDarkMode = false }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  // Build page number window: always show first, last, current ±1
  const pages = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);

  // Insert ellipsis markers
  const items = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push("...");
    items.push(p);
    prev = p;
  }

  const btn = (active) =>
    active
      ? "min-w-[32px] h-8 px-2 rounded-lg text-sm font-semibold bg-brand-primary text-white"
      : isDarkMode
      ? "min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 transition"
      : "min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition";

  const navBtn = (disabled) =>
    `w-8 h-8 flex items-center justify-center rounded-lg transition ${
      disabled
        ? "opacity-30 cursor-not-allowed"
        : isDarkMode
        ? "text-gray-300 hover:bg-gray-700"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className={`flex items-center justify-between gap-4 px-1 py-3 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
      {/* Record count */}
      <span className="text-xs">
        Showing <span className="font-semibold">{from}–{to}</span> of <span className="font-semibold">{total}</span>
      </span>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          className={navBtn(page === 1)}
          onClick={() => page > 1 && onPage(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page numbers */}
        {items.map((item, i) =>
          item === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm select-none">…</span>
          ) : (
            <button key={item} className={btn(item === page)} onClick={() => onPage(item)}>
              {item}
            </button>
          )
        )}

        {/* Next */}
        <button
          className={navBtn(page === totalPages)}
          onClick={() => page < totalPages && onPage(page + 1)}
          disabled={page === totalPages}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
