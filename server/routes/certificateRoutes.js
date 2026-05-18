// server/routes/certificateRoutes.js
// Certificate CRUD + pdfkit PDF generation + auto-award helper.
import express from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import { tenantMiddleware }   from '../middleware/tenantMiddleware.js';
import { certificateSchema }  from '../schemas/certificateSchema.js';
import { studentSchema }      from '../schemas/studentSchema.js';
import { bookingSchema }      from '../schemas/bookingSchema.js';
import Center from '../models/master/Center.js';
import { getCenterBaseUrl } from '../emails/core.js';
import logger from '../utils/logger.js';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/apiResponse.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { parsePagination }  from '../utils/pagination.js';

const router = express.Router();
router.use(tenantMiddleware);

const getCert    = (db) => db.models.Certificate || db.model('Certificate', certificateSchema);
const getStudent = (db) => db.models.Student     || db.model('Student',     studentSchema);
const getBooking = (db) => db.models.Booking     || db.model('Booking',     bookingSchema);

// ── Unique certificate number ─────────────────────────────────────────────────
async function nextCertNumber(db, slug) {
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
      studentId, status: 'completed',
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
async function buildCertificatePdf(cert, student, center) {
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

// ── GET /certificates — list ──────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    getStudent(req.db);
    const { limit, skip } = parsePagination(req.query, 50, 200);

    let filter = {};
    if (req.user.role === 'student') {
      filter.studentId = req.user.id;
    } else if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }
    if (req.query.type) filter.type = req.query.type;

    const [certs, total] = await Promise.all([
      getCert(req.db).find(filter)
        .populate('studentId', 'firstName lastName email')
        .sort({ issuedAt: -1 }).skip(skip).limit(limit).lean(),
      getCert(req.db).countDocuments(filter),
    ]);
    res.json({ success: true, certificates: certs, total });
  } catch (err) {
    logger.error('Error listing certificates:', { error: err?.message });
    serverError(res, 'Error listing certificates');
  }
});

// ── GET /certificates/verify/:certNumber — public verify ──────────────────────
router.get('/verify/:certNumber', async (req, res) => {
  try {
    const cert = await getCert(req.db).findOne({ certificateNumber: req.params.certNumber })
      .populate('studentId', 'firstName lastName').lean();
    if (!cert) return notFound(res, 'Certificate not found');
    if (cert.revokedAt) return res.json({ success: false, valid: false, message: 'Certificate has been revoked' });
    res.json({ success: true, valid: true, certificate: {
      certificateNumber: cert.certificateNumber,
      title:   cert.title,
      student: cert.studentId,
      issuedAt: cert.issuedAt,
    }});
  } catch (err) {
    serverError(res, 'Error verifying certificate');
  }
});

// ── GET /certificates/:id/pdf — generate and stream PDF ───────────────────────
router.get('/:id/pdf', verifyToken, validateObjectId('id'), async (req, res) => {
  try {
    const cert = await getCert(req.db).findById(req.params.id).lean();
    if (!cert) return notFound(res, 'Certificate not found');

    const isOwner = req.user.role === 'student' && cert.studentId.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') return forbidden(res, 'Not authorized');

    const student = await getStudent(req.db).findById(cert.studentId).select('firstName lastName studentId').lean();
    const center  = req.center; // set by tenantMiddleware

    const pdfBuffer = await buildCertificatePdf(cert, student || { firstName: 'Student', lastName: '' }, center);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${cert.certificateNumber}.pdf"`,
      'Content-Length':      pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Error generating certificate PDF:', { error: err?.message });
    serverError(res, 'Error generating certificate PDF');
  }
});

// ── POST /certificates — admin manually awards ────────────────────────────────
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { studentId, title, description } = req.body;
    if (!studentId || !title) return badRequest(res, 'studentId and title required');

    const student = await getStudent(req.db).findById(studentId);
    if (!student) return notFound(res, 'Student not found');

    const certNumber = await nextCertNumber(req.db, req.center?.slug || 'CTR');
    const cert = await getCert(req.db).create({
      studentId, title, description: description || '',
      certificateNumber: certNumber, issuedBy: 'admin', type: 'manual',
    });
    res.status(201).json({ success: true, message: 'Certificate awarded', certificate: cert });
  } catch (err) {
    logger.error('Error creating certificate:', { error: err?.message });
    serverError(res, 'Error creating certificate');
  }
});

// ── DELETE /certificates/:id — revoke (admin only) ───────────────────────────
router.delete('/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const cert = await getCert(req.db).findByIdAndUpdate(
      req.params.id, { revokedAt: new Date() }, { new: true }
    );
    if (!cert) return notFound(res, 'Certificate not found');
    res.json({ success: true, message: 'Certificate revoked' });
  } catch (err) {
    serverError(res, 'Error revoking certificate');
  }
});

export default router;
