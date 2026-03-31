// server/utils/recordPdfGenerator.js
// Generates PDF record buffers (server-side) using PDFKit.
// Called on student/teacher creation to attach to admin notification email.

import PDFDocument from "pdfkit";

const PAGE_W = 595.28; // A4 width in points
const MARGIN  = 50;
const COL_W   = 160;   // label column width

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtNow() {
  const now = new Date();
  return now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
    " at " + now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ── Draw header banner ────────────────────────────────────────────────────────
function drawHeader(doc, centerName, title, subtitle, color) {
  doc.rect(0, 0, PAGE_W, 90).fill(color);

  // Center name
  doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
    .text(centerName, MARGIN, 22, { width: PAGE_W - MARGIN * 2 });

  // Title / subtitle
  doc.fontSize(11).font("Helvetica")
    .text(title, MARGIN, 50);
  doc.fontSize(9)
    .text(`Generated: ${fmtNow()}`, MARGIN, 66);

  doc.moveDown();
}

// ── Draw a two-column detail row ──────────────────────────────────────────────
function drawRow(doc, label, value, y, shade) {
  const rowH = 24;
  if (shade) {
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH).fill("#f0f4ff");
  }
  doc.fillColor("#3730a3").fontSize(9).font("Helvetica-Bold")
    .text(label, MARGIN + 6, y + 7, { width: COL_W - 6 });
  doc.fillColor("#1e293b").fontSize(9).font("Helvetica")
    .text(String(value || "—"), MARGIN + COL_W + 6, y + 7, { width: PAGE_W - MARGIN * 2 - COL_W - 6 });

  // Bottom border
  doc.strokeColor("#e2e8f0").lineWidth(0.5)
    .moveTo(MARGIN, y + rowH).lineTo(PAGE_W - MARGIN, y + rowH).stroke();

  return y + rowH;
}

// ── Section heading ───────────────────────────────────────────────────────────
function drawSection(doc, text, y, color) {
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 22).fill(color);
  doc.fillColor("white").fontSize(9).font("Helvetica-Bold")
    .text(text.toUpperCase(), MARGIN + 8, y + 7);
  return y + 22;
}

// ── Footer ────────────────────────────────────────────────────────────────────
function drawFooter(doc, centerName, type) {
  const H = 841.89;
  doc.rect(0, H - 36, PAGE_W, 36).fill("#f8fafc");
  doc.strokeColor("#e2e8f0").lineWidth(0.5)
    .moveTo(0, H - 36).lineTo(PAGE_W, H - 36).stroke();
  doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica")
    .text(
      `${centerName}  •  ${type}  •  Confidential  •  ${fmtDate(new Date())}`,
      MARGIN, H - 22, { width: PAGE_W - MARGIN * 2, align: "center" }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT RECORD PDF
// ─────────────────────────────────────────────────────────────────────────────
export function generateStudentRecordPdf(student, centerName) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on("data",  chunk => chunks.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fullName = `${student.firstName || ""} ${student.surname || ""}`.trim();

    // ── Header ──
    drawHeader(doc, centerName, `New Student Record: ${fullName}`, "", "#2563eb");

    // ── Status badge area ──
    let statusText, statusColor;
    if (student.status === "pending") { statusText = "Pending Setup"; statusColor = "#d97706"; }
    else if (!student.active)          { statusText = "Disabled";      statusColor = "#6b7280"; }
    else                               { statusText = "Active";        statusColor = "#059669"; }

    doc.roundedRect(PAGE_W - MARGIN - 100, 30, 90, 22, 4).fill(statusColor);
    doc.fillColor("white").fontSize(9).font("Helvetica-Bold")
      .text(statusText, PAGE_W - MARGIN - 100, 39, { width: 90, align: "center" });

    // ── Personal details section ──
    let y = 108;
    y = drawSection(doc, "Personal Information", y, "#1d4ed8");

    const personalRows = [
      ["First Name",    student.firstName],
      ["Surname",       student.surname],
      ["Email Address", student.email],
      ["Phone Number",  student.phone],
      ["Country",       student.country],
      ["Age",           student.age ? `${student.age} years old` : null],
      ["Date of Birth", fmtDate(student.dateOfBirth)],
    ];
    personalRows.forEach(([label, val], i) => {
      y = drawRow(doc, label, val, y, i % 2 === 0);
    });

    // ── Academic details section ──
    y += 10;
    y = drawSection(doc, "Academic Information", y, "#1d4ed8");

    const academicRows = [
      ["Level / Rank",       student.rank],
      ["Classes Purchased",  student.noOfClasses ?? 0],
      ["Account Status",     statusText],
    ];
    academicRows.forEach(([label, val], i) => {
      y = drawRow(doc, label, val, y, i % 2 === 0);
    });

    // ── Note box ──
    y += 20;
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 44).fill("#eff6ff");
    doc.strokeColor("#bfdbfe").lineWidth(0.5)
      .rect(MARGIN, y, PAGE_W - MARGIN * 2, 44).stroke();
    doc.fillColor("#1d4ed8").fontSize(9).font("Helvetica-Bold")
      .text("ADMIN NOTE", MARGIN + 10, y + 9);
    doc.fillColor("#374151").fontSize(8.5).font("Helvetica")
      .text(
        "An invite email has been sent to the student at the address above. They will receive a link valid for 48 hours to set their password and activate their account.",
        MARGIN + 10, y + 22, { width: PAGE_W - MARGIN * 2 - 20 }
      );

    drawFooter(doc, centerName, "New Student Record");
    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER RECORD PDF
// ─────────────────────────────────────────────────────────────────────────────
export function generateTeacherRecordPdf(teacher, centerName) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on("data",  chunk => chunks.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();

    // ── Header ──
    drawHeader(doc, centerName, `New Teacher Record: ${fullName}`, "", "#7c3aed");

    // ── Status badge ──
    let statusText, statusColor;
    if (teacher.status === "pending") { statusText = "Pending Setup"; statusColor = "#d97706"; }
    else if (!teacher.active)          { statusText = "Disabled";      statusColor = "#6b7280"; }
    else                               { statusText = "Active";        statusColor = "#059669"; }

    doc.roundedRect(PAGE_W - MARGIN - 100, 30, 90, 22, 4).fill(statusColor);
    doc.fillColor("white").fontSize(9).font("Helvetica-Bold")
      .text(statusText, PAGE_W - MARGIN - 100, 39, { width: 90, align: "center" });

    // ── Personal details ──
    let y = 108;
    y = drawSection(doc, "Personal Information", y, "#6d28d9");

    const personalRows = [
      ["First Name",    teacher.firstName],
      ["Last Name",     teacher.lastName],
      ["Email Address", teacher.email],
      ["Phone",         teacher.phone],
      ["Country",       teacher.country],
      ["Continent",     teacher.continent],
    ];
    personalRows.forEach(([label, val], i) => {
      y = drawRow(doc, label, val, y, i % 2 === 0);
    });

    // ── Professional details ──
    y += 10;
    y = drawSection(doc, "Professional Information", y, "#6d28d9");

    const professionalRows = [
      ["Timezone",           teacher.timezone],
      ["Rate per Class",     teacher.ratePerClass ? `$${teacher.ratePerClass} USD` : null],
      ["Years of Experience", teacher.yearsOfExperience ? `${teacher.yearsOfExperience} years` : null],
      ["Specializations",   (teacher.specializations || []).join(", ") || null],
      ["Certifications",    (teacher.certifications  || []).join(", ") || null],
      ["Google Meet / Zoom", teacher.googleMeetLink],
      ["Account Status",    statusText],
    ];
    professionalRows.forEach(([label, val], i) => {
      y = drawRow(doc, label, val, y, i % 2 === 0);
    });

    // ── Bio (if present) ──
    if (teacher.bio) {
      y += 10;
      y = drawSection(doc, "Bio", y, "#6d28d9");
      doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 60).fill("#faf5ff");
      doc.fillColor("#374151").fontSize(9).font("Helvetica")
        .text(teacher.bio, MARGIN + 10, y + 10, {
          width: PAGE_W - MARGIN * 2 - 20,
          height: 50,
          ellipsis: true,
        });
      y += 60;
    }

    // ── Note box ──
    y += 12;
    // Guard against overflowing footer
    if (y > 750) y = 680;
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 44).fill("#f5f3ff");
    doc.strokeColor("#ddd6fe").lineWidth(0.5)
      .rect(MARGIN, y, PAGE_W - MARGIN * 2, 44).stroke();
    doc.fillColor("#6d28d9").fontSize(9).font("Helvetica-Bold")
      .text("ADMIN NOTE", MARGIN + 10, y + 9);
    doc.fillColor("#374151").fontSize(8.5).font("Helvetica")
      .text(
        "An invite email has been sent to the teacher at the address above. They will receive a link valid for 48 hours to set their password and activate their account.",
        MARGIN + 10, y + 22, { width: PAGE_W - MARGIN * 2 - 20 }
      );

    drawFooter(doc, centerName, "New Teacher Record");
    doc.end();
  });
}
