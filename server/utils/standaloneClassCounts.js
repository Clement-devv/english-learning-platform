import { bookingSchema } from '../schemas/bookingSchema.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
export async function usedClassCounts(db, studentIds) {
  const field = 'standaloneCompletion.chargedStudentIds';
  const pipeline = [
    { $match: { status: 'completed', [field]: { $in: studentIds } } },
    { $unwind: '$' + field },
    { $match: { [field]: { $in: studentIds } } },
    { $group: { _id: '$' + field, count: { $sum: 1 } } },
  ];
  const counts = new Map();
  const Booking = db.models.Booking || db.model('Booking', bookingSchema);
  const Group = db.models.GroupClass || db.model('GroupClass', groupClassSchema);
  const rows = await Promise.all([Booking.aggregate(pipeline), Group.aggregate(pipeline)]);
  for (const row of rows.flat()) {
    const id = String(row._id);
    counts.set(id, (counts.get(id) || 0) + row.count);
  }
  return counts;
}
