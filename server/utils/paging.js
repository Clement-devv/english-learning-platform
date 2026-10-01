// server/utils/paging.js
// Shared helpers for paged list endpoints (?page=&limit=).
import mongoose from "mongoose";

export const PAGE_SIZE = 20;

/** Read ?page & ?limit (limit capped so a client can't ask for everything). */
export function readPaging(query, { defaultLimit = PAGE_SIZE, maxLimit = 50 } = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const page  = Math.max(parseInt(query.page, 10) || 1, 1);
  return { page, limit };
}

/** Clamp the page to what exists (e.g. the last item on the last page was deleted). */
export function pageMeta(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page: Math.min(page, totalPages), limit, total, totalPages };
}

/** Count documents per status → { all, <status>: n, … } (every listed status present, 0 if none). */
export async function statusCounts(Model, match, statuses) {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
  const counts = { all: 0 };
  statuses.forEach(s => { counts[s] = 0; });
  rows.forEach(r => { counts.all += r.n; if (r._id in counts) counts[r._id] = r.n; });
  return counts;
}

/** Aggregate pipelines don't cast ids the way find() does. */
export const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Student lists: to-do items first (soonest due first), then everything else
 * (most recent due first). Returns the ids for one page, in order.
 */
export async function todoFirstIds(Model, match, todoStatus, { page, limit }) {
  const due = { $toLong: { $ifNull: ["$dueDate", new Date(0)] } };
  const rows = await Model.aggregate([
    { $match: match },
    { $addFields: {
      _grp: { $cond: [{ $eq: ["$status", todoStatus] }, 0, 1] },
      _key: { $cond: [{ $eq: ["$status", todoStatus] }, due, { $multiply: [-1, due] }] },
    } },
    { $sort: { _grp: 1, _key: 1, _id: 1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { _id: 1 } },
  ]);
  return rows.map(r => String(r._id));
}

/** Put find() results back in the order of `ids`. */
export const inOrder = (docs, ids) => {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return docs.sort((a, b) => pos.get(String(a._id)) - pos.get(String(b._id)));
};
