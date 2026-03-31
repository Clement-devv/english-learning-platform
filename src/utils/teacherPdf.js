// src/utils/teacherPdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function statusLabel(t) {
  if (t.scheduledDeletionAt) return "Pending Deletion";
  if (t.status === "pending")  return "Pending Setup";
  if (!t.active)               return "Disabled";
  return "Active";
}

function statusColors(label) {
  switch (label) {
    case "Active":           return { bg: [209, 250, 229], text: [5,   150, 105] };
    case "Pending Setup":    return { bg: [254, 249, 195], text: [161,  98,   7] };
    case "Disabled":         return { bg: [229, 231, 235], text: [107, 114, 128] };
    case "Pending Deletion": return { bg: [254, 226, 226], text: [220,  38,  38] };
    default:                 return { bg: [229, 231, 235], text: [107, 114, 128] };
  }
}

const PURPLE    = [109,  40, 217];
const DARK_PUR  = [ 76,  29, 149];
const LIGHT_PUR = [245, 243, 255];
const SLATE     = [ 30,  41,  59];
const MUTED     = [148, 163, 184];
const WHITE     = [255, 255, 255];

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
      `${centerName}  •  Teacher Records  •  Confidential  •  Page ${i} of ${total}`,
      W / 2, H - 6, { align: "center" }
    );
  }
}

// ── ROSTER PDF ────────────────────────────────────────────────────────────────
export function downloadTeacherRoster(teachers, centerName) {
  const name = centerName || document.title || "English Learning Center";
  const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const now  = new Date();

  // Header banner
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 26, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(name, 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Teacher Records — Offline Backup", 14, 18);

  doc.setFontSize(8);
  const stamp = `Generated ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  doc.text(stamp, W - 14, 11, { align: "right" });
  doc.text(`${teachers.length} teacher${teachers.length !== 1 ? "s" : ""}`, W - 14, 18, { align: "right" });

  // Summary pills
  const active   = teachers.filter(t => t.active && !t.scheduledDeletionAt).length;
  const pending  = teachers.filter(t => t.status === "pending").length;
  const disabled = teachers.filter(t => !t.active && !t.scheduledDeletionAt).length;
  const totalLessons = teachers.reduce((n, t) => n + (t.lessonsCompleted || 0), 0);

  const pills = [
    { label: "Active",   value: active,        color: [5,   150, 105] },
    { label: "Pending",  value: pending,        color: [161,  98,   7] },
    { label: "Disabled", value: disabled,       color: [107, 114, 128] },
    { label: "Lessons",  value: totalLessons,   color: [...PURPLE]     },
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

  // Table rows
  const rows = teachers.map((t, i) => [
    i + 1,
    `${t.firstName || ""} ${t.lastName || ""}`.trim() || "—",
    t.email || "—",
    t.phone || "—",
    t.country || "—",
    t.continent || "—",
    t.ratePerClass ? `$${t.ratePerClass}` : "—",
    t.yearsOfExperience ? `${t.yearsOfExperience}y` : "—",
    t.lessonsCompleted ?? 0,
    t.earned ? `$${Number(t.earned).toFixed(2)}` : "$0.00",
    (t.specializations || []).slice(0, 2).join(", ") || "—",
    statusLabel(t),
  ]);

  autoTable(doc, {
    startY: 44,
    head: [["#", "Full Name", "Email", "Phone", "Country", "Continent", "Rate", "Exp", "Lessons", "Earned", "Specializations", "Status"]],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: DARK_PUR,
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
      fillColor: LIGHT_PUR,
    },
    columnStyles: {
      0:  { cellWidth: 8,  halign: "center" },
      6:  { cellWidth: 14, halign: "center" },
      7:  { cellWidth: 10, halign: "center" },
      8:  { cellWidth: 14, halign: "center" },
      9:  { cellWidth: 18, halign: "center" },
      11: { cellWidth: 24, halign: "center" },
    },
    willDrawCell(data) {
      if (data.section === "body" && data.column.index === 11) {
        const sc = statusColors(data.cell.raw);
        data.cell.styles.textColor = sc.text;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { top: 44, left: 14, right: 14, bottom: 18 },
  });

  drawFooter(doc, name);

  const file = `${name.replace(/\s+/g, "_")}_Teachers_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(file);
}

// ── SINGLE TEACHER PDF ────────────────────────────────────────────────────────
export function downloadTeacherCard(teacher, centerName) {
  const name = centerName || document.title || "English Learning Center";
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W    = doc.internal.pageSize.getWidth();
  const now  = new Date();

  const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "Teacher";
  const initials = `${(teacher.firstName || " ")[0]}${(teacher.lastName || " ")[0]}`.toUpperCase();
  const sl       = statusLabel(teacher);
  const sc       = statusColors(sl);

  // ── Header banner ──
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 36, "F");

  // Avatar circle
  doc.setFillColor(255, 255, 255);
  doc.circle(24, 18, 11, "F");
  doc.setTextColor(...PURPLE);
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
  doc.text(teacher.email || "", 40, 21);
  doc.text(`${name}  •  Teacher`, 40, 28);

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

  // ── Section: Personal & Professional ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_PUR);
  doc.text("TEACHER PROFILE", 14, 44);
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.5);
  doc.line(14, 45.5, W - 14, 45.5);

  const rows = [
    ["First Name",          teacher.firstName         || "—"],
    ["Last Name",           teacher.lastName          || "—"],
    ["Email Address",       teacher.email             || "—"],
    ["Phone / WhatsApp",    teacher.phone             || "—"],
    ["Country",             teacher.country           || "—"],
    ["Continent",           teacher.continent         || "—"],
    ["Timezone",            teacher.timezone          || "—"],
    ["Rate per Class",      teacher.ratePerClass ? `$${teacher.ratePerClass} USD` : "—"],
    ["Years of Experience", teacher.yearsOfExperience ? `${teacher.yearsOfExperience} years` : "—"],
    ["Lessons Completed",   String(teacher.lessonsCompleted ?? 0)],
    ["Total Earned",        teacher.earned ? `$${Number(teacher.earned).toFixed(2)} USD` : "$0.00"],
    ["Specializations",     (teacher.specializations || []).join(", ") || "—"],
    ["Certifications",      (teacher.certifications  || []).join(", ") || "—"],
    ["Meet / Zoom Link",    teacher.googleMeetLink    || "—"],
    ["Account Status",      sl],
    ["Member Since",        fmt(teacher.createdAt)],
  ];

  autoTable(doc, {
    startY: 49,
    body: rows,
    theme: "grid",
    bodyStyles: {
      fontSize: 9.5,
      textColor: SLATE,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: LIGHT_PUR,
        textColor: DARK_PUR,
        cellWidth: 55,
      },
      1: { cellWidth: "auto" },
    },
    willDrawCell(data) {
      if (data.section === "body" && data.column.index === 1) {
        // Color status
        if (data.row.index === 14) {
          data.cell.styles.textColor = sc.text;
          data.cell.styles.fontStyle = "bold";
        }
        // Color lessons
        if (data.row.index === 9) {
          data.cell.styles.textColor = [...PURPLE];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  // ── Bio section (if present) ──
  if (teacher.bio) {
    const bioY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_PUR);
    doc.text("BIO", 14, bioY);
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(0.3);
    doc.line(14, bioY + 1.5, W - 14, bioY + 1.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    const bioLines = doc.splitTextToSize(teacher.bio, W - 28);
    doc.text(bioLines, 14, bioY + 7);
  }

  // ── Admin note ──
  const noteY = doc.lastAutoTable
    ? doc.lastAutoTable.finalY + (teacher.bio ? 20 + Math.ceil((teacher.bio.length / 80)) * 5 : 8)
    : 260;
  const safeNoteY = Math.min(noteY, 260); // don't overflow page
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, safeNoteY, W - 28, 16, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("ADMIN NOTE", 20, safeNoteY + 6);
  doc.setFont("helvetica", "normal");
  doc.text("This document is an official offline record generated from the teacher management system.", 20, safeNoteY + 12);
  doc.text("Keep in a secure location. Do not share without authorisation.", 20, safeNoteY + 16.5);

  drawFooter(doc, name);

  const file = `${fullName.replace(/\s+/g, "_")}_Profile_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(file);
}
