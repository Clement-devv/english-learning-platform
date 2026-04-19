// src/utils/studentPdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function statusLabel(s) {
  if (s.scheduledDeletionAt) return "Pending Deletion";
  if (s.status === "pending")  return "Pending Setup";
  if (!s.active)               return "Disabled";
  return "Active";
}

function statusColors(label) {
  switch (label) {
    case "Active":           return { bg: [209, 250, 229], text: [5, 150, 105] };
    case "Pending Setup":    return { bg: [254, 249, 195], text: [161, 98, 7] };
    case "Disabled":         return { bg: [229, 231, 235], text: [107, 114, 128] };
    case "Pending Deletion": return { bg: [254, 226, 226], text: [220, 38, 38] };
    default:                 return { bg: [229, 231, 235], text: [107, 114, 128] };
  }
}

const BLUE     = [37,  99,  235];
const DARK_BLU = [30,  64,  175];
const LIGHT_BL = [239, 246, 255];
const SLATE    = [30,  41,  59];
const MUTED    = [148, 163, 184];
const WHITE    = [255, 255, 255];

// ── Draw page footer ──────────────────────────────────────────────────────────
function drawFooter(doc, centerName) {
  const total = doc.internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.3);
    doc.line(14, H - 12, W - 14, H - 12);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${centerName}  •  Student Records  •  Confidential  •  Page ${i} of ${total}`,
      W / 2, H - 6, { align: "center" }
    );
  }
}

// ── ROSTER PDF ─────────────────────────────────────────────────────────────────
// Downloads a full table of all provided students.
export function downloadStudentRoster(students, centerName) {
  const name = centerName || document.title || "English Learning Center";
  const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const now  = new Date();

  // Header banner
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 26, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(name, 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Student Records — Offline Backup", 14, 18);

  doc.setFontSize(8);
  const stamp = `Generated ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  doc.text(stamp, W - 14, 11, { align: "right" });
  doc.text(`${students.length} student${students.length !== 1 ? "s" : ""}`, W - 14, 18, { align: "right" });

  // Summary pills row
  const active   = students.filter(s => s.active && !s.scheduledDeletionAt).length;
  const pending  = students.filter(s => s.status === "pending").length;
  const disabled = students.filter(s => !s.active && !s.scheduledDeletionAt).length;
  const total    = students.reduce((n, s) => n + (s.classCredits || 0), 0);

  const pills = [
    { label: "Active",    value: active,   color: [5,  150, 105] },
    { label: "Pending",   value: pending,  color: [161, 98,  7]  },
    { label: "Disabled",  value: disabled, color: [107, 114, 128]},
    { label: "Classes",   value: total,    color: [37,  99,  235]},
  ];
  let px = 14;
  pills.forEach(p => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(px, 30, 44, 10, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...p.color);
    doc.setFont("helvetica", "bold");
    doc.text(String(p.value), px + 10, 36);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(p.label, px + 16, 36);
    px += 47;
  });

  // Table
  const rows = students.map((s, i) => [
    i + 1,
    `${s.firstName || ""} ${s.lastName || ""}`.trim() || "—",
    s.email || "—",
    s.phone || "—",
    s.country || "—",
    s.rank || "—",
    s.age ? `${s.age}y` : "—",
    s.classCredits ?? 0,
    fmt(s.lastPaymentDate),
    fmt(s.dateOfBirth),
    statusLabel(s),
  ]);

  autoTable(doc, {
    startY: 44,
    head: [["#", "Full Name", "Email", "Phone", "Country", "Level", "Age", "Classes", "Last Payment", "Date of Birth", "Status"]],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: DARK_BLU,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: SLATE,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: LIGHT_BL,
    },
    columnStyles: {
      0:  { cellWidth: 8,  halign: "center" },
      6:  { cellWidth: 12, halign: "center" },
      7:  { cellWidth: 14, halign: "center" },
      10: { cellWidth: 24, halign: "center" },
    },
    willDrawCell(data) {
      if (data.section === "body" && data.column.index === 10) {
        const sc = statusColors(data.cell.raw);
        data.cell.styles.textColor = sc.text;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { top: 44, left: 14, right: 14, bottom: 18 },
  });

  drawFooter(doc, name);

  const file = `${name.replace(/\s+/g, "_")}_Students_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(file);
}

// ── SINGLE STUDENT PDF ─────────────────────────────────────────────────────────
// Downloads a profile sheet for one student.
export function downloadStudentCard(student, centerName) {
  const name = centerName || document.title || "English Learning Center";
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const now  = new Date();

  const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Student";
  const initials = `${(student.firstName || " ")[0]}${(student.lastName || " ")[0]}`.toUpperCase();
  const sl       = statusLabel(student);
  const sc       = statusColors(sl);

  // ── Header banner ──
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 36, "F");

  // Avatar circle
  doc.setFillColor(255, 255, 255);
  doc.circle(24, 18, 11, "F");
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(initials, 24, 21.5, { align: "center" });

  // Name & meta
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(fullName, 40, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(student.email || "", 40, 21);
  doc.text(name, 40, 28);

  // Generated date (top right)
  doc.setFontSize(7.5);
  doc.text(`Generated ${now.toLocaleDateString("en-GB")}`, W - 14, 28, { align: "right" });

  // ── Status badge ──
  const badgeW = 38;
  const badgeX = W - 14 - badgeW;
  doc.setFillColor(...sc.bg);
  doc.roundedRect(badgeX, 38, badgeW, 8, 2, 2, "F");
  doc.setTextColor(...sc.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(sl, badgeX + badgeW / 2, 43.5, { align: "center" });

  // ── Section title ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_BLU);
  doc.text("STUDENT PROFILE", 14, 44);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(14, 45.5, W - 14, 45.5);

  // ── Details table ──
  const rows = [
    ["First Name",         student.firstName  || "—"],
    ["Surname",            student.lastName    || "—"],
    ["Email Address",      student.email      || "—"],
    ["Phone Number",       student.phone      || "—"],
    ["Country",            student.country    || "—"],
    ["Level / Rank",       student.rank       || "—"],
    ["Age",                student.age ? `${student.age} years old` : "—"],
    ["Date of Birth",      student.dateOfBirth ? fmt(student.dateOfBirth) : "—"],
    ["Classes Remaining",  String(student.classCredits ?? 0)],
    ["Last Payment",       fmt(student.lastPaymentDate)],
    ["Account Status",     sl],
    ["Member Since",       fmt(student.createdAt)],
  ];

  autoTable(doc, {
    startY: 49,
    body: rows,
    theme: "grid",
    bodyStyles: {
      fontSize: 10,
      textColor: SLATE,
      cellPadding: 4,
    },
    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: LIGHT_BL,
        textColor: DARK_BLU,
        cellWidth: 55,
      },
      1: { cellWidth: "auto" },
    },
    willDrawCell(data) {
      // Color the status value
      if (data.section === "body" && data.column.index === 1 && data.row.index === 10) {
        data.cell.styles.textColor = sc.text;
        data.cell.styles.fontStyle = "bold";
      }
      // Bold classes count if low
      if (data.section === "body" && data.column.index === 1 && data.row.index === 8) {
        const count = parseInt(data.cell.raw, 10);
        if (count <= 0) data.cell.styles.textColor = [220, 38, 38];
        else if (count <= 3) data.cell.styles.textColor = [234, 88, 12];
      }
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  // ── Note box ──
  const endY = doc.lastAutoTable.finalY + 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, endY, W - 28, 16, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("ADMIN NOTE", 20, endY + 6);
  doc.setFont("helvetica", "normal");
  doc.text("This document is an official offline record generated from the student management system.", 20, endY + 12);
  doc.text("Keep in a secure location. Do not share without authorisation.", 20, endY + 16.5);

  drawFooter(doc, name);

  const file = `${fullName.replace(/\s+/g, "_")}_Profile_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(file);
}
