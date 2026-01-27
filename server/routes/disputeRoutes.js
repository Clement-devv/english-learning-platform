
import express from 'express';
const router = express.Router();

import Booking from '../models/Booking.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';


// @route   GET /api/disputes
// @desc    Get all disputed bookings
// @access  Admin only
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const disputes = await Booking.find({ status: 'disputed' })
      .populate('studentId', 'firstName lastName email')
      .populate('teacherId', 'firstName lastName email ratePerClass')
      .sort({ disputedAt: -1 }); // Most recent first

    console.log(`📋 Found ${disputes.length} disputed bookings`);

    res.json({
      success: true,
      count: disputes.length,
      disputes: disputes
    });
  } catch (error) {
    console.error('❌ Error fetching disputes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch disputes',
      error: error.message
    });
  }
});

// @route   PATCH /api/disputes/:id/resolve
// @desc    Resolve a dispute (approve teacher or student)
// @access  Admin only
router.patch('/:id/resolve', protect, adminOnly, async (req, res) => {
  const session = await Booking.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { resolution, adminNotes } = req.body;

    // resolution can be: 'approve_teacher' or 'approve_student'
    if (!resolution || !['approve_teacher', 'approve_student'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resolution. Must be "approve_teacher" or "approve_student"'
      });
    }

    const booking = await Booking.findById(id)
      .populate('studentId')
      .populate('teacherId')
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'disputed') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'This booking is not disputed'
      });
    }

    if (resolution === 'approve_teacher') {
      // Teacher wins - complete the class, pay teacher, deduct student class
      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.disputeResolution = 'approved_teacher';
      booking.disputeResolvedBy = req.user._id;
      booking.disputeResolvedAt = new Date();
      booking.adminNotes = adminNotes || '';

      await booking.save({ session });

      // Update student - deduct class
      await Student.findByIdAndUpdate(
        booking.studentId._id,
        { $inc: { noOfClasses: -1 } },
        { session }
      );

      // Update teacher - increment lessons and earnings
      await Teacher.findByIdAndUpdate(
        booking.teacherId._id,
        {
          $inc: {
            lessonsCompleted: 1,
            earned: booking.teacherId.ratePerClass
          }
        },
        { session }
      );

      // Create payment transaction
      await PaymentTransaction.create([{
        teacherId: booking.teacherId._id,
        bookingId: booking._id,
        amount: booking.teacherId.ratePerClass,
        type: 'class_completion',
        status: 'pending',
        description: `Payment for completed class: ${booking.classTitle} (Dispute resolved in teacher's favor)`,
        classTitle: booking.classTitle,
        studentName: `${booking.studentId.firstName} ${booking.studentId.lastName}`,
        completedAt: new Date()
      }], { session });

      console.log(`✅ Dispute resolved in teacher's favor - Class completed`);

    } else if (resolution === 'approve_student') {
      // Student wins - cancel the class, refund student class, no payment to teacher
      booking.status = 'cancelled';
      booking.disputeResolution = 'approved_student';
      booking.disputeResolvedBy = req.user._id;
      booking.disputeResolvedAt = new Date();
      booking.adminNotes = adminNotes || '';

      await booking.save({ session });

      // Refund student's class (add it back)
      await Student.findByIdAndUpdate(
        booking.studentId._id,
        { $inc: { noOfClasses: 1 } },
        { session }
      );

      console.log(`✅ Dispute resolved in student's favor - Class cancelled, student refunded`);
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Dispute resolved in ${resolution === 'approve_teacher' ? "teacher's" : "student's"} favor`,
      booking: booking
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Error resolving dispute:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve dispute',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// @route   GET /api/disputes/stats
// @desc    Get dispute statistics
// @access  Admin only
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalDisputes = await Booking.countDocuments({ status: 'disputed' });
    const resolvedDisputes = await Booking.countDocuments({
      disputeResolution: { $exists: true }
    });
    const teacherWins = await Booking.countDocuments({
      disputeResolution: 'approved_teacher'
    });
    const studentWins = await Booking.countDocuments({
      disputeResolution: 'approved_student'
    });

    res.json({
      success: true,
      stats: {
        totalDisputes,
        resolvedDisputes,
        teacherWins,
        studentWins,
        pendingDisputes: totalDisputes
      }
    });
  } catch (error) {
    console.error('❌ Error fetching dispute stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dispute stats',
      error: error.message
    });
  }
});

export default router;