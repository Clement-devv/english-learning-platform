// server/utils/certificates.js
// Certificate numbers, milestone auto-awards and the PDF — shared by routes/certificateRoutes.js
// and the class completion service (so every way a class completes can award a milestone).
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { certificateSchema }  from '../schemas/certificateSchema.js';
import { bookingSchema }      from '../schemas/bookingSchema.js';
import Center from '../models/master/Center.js';
import { getCenterBaseUrl } from '../emails/core.js';
import logger from './logger.js';

export const getCert    = (db) => db.models.Certificate || db.model('Certificate', certificateSchema);
const getBooking = (db) => db.models.Booking     || db.model('Booking',     bookingSchema);

// ── Unique certificate number ─────────────────────────────────────────────────
export async function nextCertNumber(db, slug) {
  const year  = new Date().getFullYear();
  const prefix = `${slug.toUpperCase()}-${year}-`;
  const last   = await getCert(db)
    .findOne({ certificateNumber: new RegExp(`^${prefix}`) })
    .sort({ certificateNumber: -1 })
    .lean();
  const seq = last
    ? parseInt(last.certificateNumber.split('-').pop(), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

// ── Auto-award: call after any booking completes ──────────────────────────────
// Returns array of newly created certificate docs (may be empty).
export async function checkAndAwardCertificates(db, studentId, centerSlug, centerId) {
  try {
    const center = await Center.findById(centerId).select('certificateTemplate centerName slug').lean();
    if (!center) return [];

    const tpl = center.certificateTemplate || {};
    const milestones = (tpl.completionMilestones || []).slice().sort((a, b) => a.count - b.count);
    if (!milestones.length) return [];

    // Count all completed bookings for this student
    const completedCount = await getBooking(db).countDocuments({
      studentId, status: 'completed', adminRejected: { $ne: true }, // reversed classes don't count
    });

    const awarded = [];
    for (const ms of milestones) {
      if (completedCount < ms.count) continue;

      // Already has this milestone certificate?
      const exists = await getCert(db).findOne({ studentId, milestone: ms.count });
      if (exists) continue;

      const certNumber = await nextCertNumber(db, center.slug || centerSlug);
      const cert = await getCert(db).create({
        studentId,
        type:             'completion',
        title:            ms.title,
        description:      ms.description || '',
        milestone:        ms.count,
        classesCompleted: completedCount,
        certificateNumber: certNumber,
        issuedBy:         'system',
      });
      awarded.push(cert);
      logger.info(`Certificate awarded: ${certNumber} to student ${studentId}`);
    }
    return awarded;
  } catch (err) {
    logger.error('Certificate auto-award failed:', { error: err?.message });
    return [];
  }
}

// ── PDF builder ───────────────────────────────────────────────────────────────
export async function buildCertificatePdf(cert, student, center) {
  const tpl  = center?.certificateTemplate || {};
  const orgName = tpl.organizationName || center?.centerName || 'English Learning Center';
  const primary   = tpl.primaryColor   || '#f97316';
  const secondary = tpl.secondaryColor || '#1e293b';
  const accent    = tpl.accentColor    || '#f43f5e';

  // QR code pointing to public verify URL — uses center's custom domain or slug subdomain
  const { baseUrl } = getCenterBaseUrl(center);
  const verifyUrl = `${baseUrl}/certificates/verify/${cert.certificateNumber}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 1 });
  const qrBuffer  = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 841.89;
    const H = 595.28;

    // Background
    doc.rect(0, 0, W, H).fill('#fffbf5');

    // Outer border
    doc.roundedRect(20, 20, W - 40, H - 40, 8).lineWidth(4).strokeColor(primary).stroke();
    // Inner border
    doc.roundedRect(28, 28, W - 56, H - 56, 6).lineWidth(1.5).strokeColor(accent).stroke();

    // Top accent bar
    doc.rect(28, 28, W - 56, 6).fill(primary);

    // Corner decorations
    const corners = [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]];
    corners.forEach(([x, y]) => {
      doc.circle(x, y, 4).fill(accent);
    });

    // Organisation name
    doc.fontSize(13).font('Helvetica-Bold').fillColor(primary)
      .text(orgName.toUpperCase(), 0, 55, { align: 'center', width: W, characterSpacing: 2 });

    // Divider
    const divY = 82;
    doc.moveTo(W / 2 - 80, divY).lineTo(W / 2 + 80, divY).lineWidth(1).strokeColor(accent).stroke();

    // "CERTIFICATE OF ACHIEVEMENT"
    doc.fontSize(28).font('Helvetica-Bold').fillColor(secondary)
      .text('CERTIFICATE OF ACHIEVEMENT', 0, 94, { align: 'center', width: W });

    // Subtitle
    doc.fontSize(12).font('Helvetica').fillColor('#64748b')
      .text('This is to proudly certify that', 0, 138, { align: 'center', width: W });

    // Student name
    const studentName = `${student.firstName} ${student.lastName}`.trim();
    doc.fontSize(36).font('Helvetica-BoldOblique').fillColor(primary)
      .text(studentName, 0, 158, { align: 'center', width: W });

    // Student ID (shown small, below name)
    if (student.studentId) {
      doc.fontSize(9).font('Helvetica').fillColor('#94a3b8')
        .text(student.studentId, 0, 200, { align: 'center', width: W });
    }

    // Name underline
    const nameY = 204;
    doc.moveTo(W / 2 - 140, nameY).lineTo(W / 2 + 140, nameY).lineWidth(1.5).strokeColor(primary).stroke();

    // Achievement text
    const desc = cert.description || `has successfully completed ${cert.classesCompleted} English lessons`;
    doc.fontSize(13).font('Helvetica').fillColor(secondary)
      .text(desc, 60, 218, { align: 'center', width: W - 120 });

    // Certificate title box
    doc.roundedRect(W / 2 - 130, 248, 260, 34, 6).fill(primary + '18');
    doc.fontSize(15).font('Helvetica-Bold').fillColor(primary)
      .text(cert.title, W / 2 - 130, 256, { width: 260, align: 'center' });

    // Date & cert number row
    const issuedDate = new Date(cert.issuedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    doc.fontSize(11).font('Helvetica').fillColor('#64748b')
      .text(`Issued: ${issuedDate}`, 60, 300, { width: 300 })
      .text(`Certificate No: ${cert.certificateNumber}`, W - 360, 300, { width: 300, align: 'right' });

    // Signature line
    const sigX = W / 2 - 100;
    const sigY = 330;
    doc.moveTo(sigX, sigY + 28).lineTo(sigX + 200, sigY + 28).lineWidth(1).strokeColor('#cbd5e1').stroke();
    const sigName  = tpl.signatureName  || '';
    const sigTitle = tpl.signatureTitle || 'Director of Studies';
    if (sigName) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(secondary)
        .text(sigName, sigX, sigY + 32, { width: 200, align: 'center' });
    }
    doc.fontSize(10).font('Helvetica').fillColor('#94a3b8')
      .text(sigTitle, sigX, sigY + (sigName ? 46 : 32), { width: 200, align: 'center' });

    // QR code (bottom-right)
    doc.image(qrBuffer, W - 120, H - 120, { width: 90, height: 90 });
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
      .text('Scan to verify', W - 120, H - 28, { width: 90, align: 'center' });

    // Footer text
    const footer = tpl.footerText || 'This certificate is issued digitally and is valid without a physical signature.';
    doc.fontSize(9).font('Helvetica').fillColor('#94a3b8')
      .text(footer, 60, H - 44, { width: W - 220, align: 'center' });

    doc.end();
  });
}

