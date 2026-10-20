// server/routes/certificateRoutes.js
// Certificate CRUD + pdfkit PDF generation + auto-award helper.
import express from 'express';
import mongoose from 'mongoose';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import { tenantMiddleware }   from '../middleware/tenantMiddleware.js';
import { certificateSchema }  from '../schemas/certificateSchema.js';
import { studentSchema }      from '../schemas/studentSchema.js';
import logger from '../utils/logger.js';
import { badRequest, forbidden, notFound, serverError } from '../utils/apiResponse.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { parsePagination }  from '../utils/pagination.js';
import { nextCertNumber, buildCertificatePdf } from '../utils/certificates.js';
import { emailCertificate } from '../utils/progressEmails.js';
import { toStr } from '../utils/inputSanitizer.js';


const router = express.Router();
router.use(tenantMiddleware);

const getCert    = (db) => db.models.Certificate || db.model('Certificate', certificateSchema);
const getStudent = (db) => db.models.Student     || db.model('Student',     studentSchema);

// ── GET /certificates — list ──────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    getStudent(req.db);
    const { limit, skip } = parsePagination(req.query, 50, 200);

    // Allow-list: a student sees their own; an admin sees all (optionally filtered).
    // Parents use /parents/me/child/:id/certificates, which checks the child link.
    let filter = {};
    if (req.user.role === 'student') {
      filter.studentId = req.user.id;
    } else if (req.user.role === 'admin') {
      if (typeof req.query.studentId === 'string') filter.studentId = req.query.studentId;
    } else {
      return forbidden(res, 'Not authorized to list certificates');
    }
    if (typeof req.query.type === 'string') filter.type = req.query.type;

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
  } catch {
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
    const { studentId } = req.body;
    const title       = toStr(req.body.title, 'title', { required: true, maxLen: 120 });
    const description = toStr(req.body.description, 'description', { maxLen: 500 });
    if (!studentId || !title) return badRequest(res, 'studentId and title required');
    if (!mongoose.isValidObjectId(studentId)) return badRequest(res, 'Invalid student');

    const student = await getStudent(req.db).findById(studentId);
    if (!student) return notFound(res, 'Student not found');

    const certNumber = await nextCertNumber(req.db, req.center?.slug || 'CTR');
    const cert = await getCert(req.db).create({
      studentId, title, description: description || '',
      certificateNumber: certNumber, issuedBy: 'admin', type: 'manual',
    });
    res.status(201).json({ success: true, message: 'Certificate awarded', certificate: cert });
    emailCertificate(req.db, req.center, cert._id); // student / family / parents, PDF attached
  } catch (err) {
    if (err.statusCode !== 400) logger.error('Error creating certificate:', { error: err?.message });
    serverError(res, 'Error creating certificate', err);
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
  } catch {
    serverError(res, 'Error revoking certificate');
  }
});

export default router;
