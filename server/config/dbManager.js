import mongoose from 'mongoose';
import logger from "../utils/logger.js";

const connections = {};

const mongooseOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

// Strict allowlist: lowercase letters, digits, hyphens only (no dots, slashes, query chars)
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/;

// slug → Promise<Connection>. The PROMISE is stored as soon as the connection
// starts opening, so simultaneous first requests for a center share one
// connection (storing it only after `await` let each of them open its own,
// and the extras were never closed).
export const getDb = (centerSlug) => {
  if (!SLUG_RE.test(centerSlug)) {
    return Promise.reject(new Error(`Invalid center slug: "${centerSlug}"`));
  }
  if (connections[centerSlug]) return connections[centerSlug];
  const base = (process.env.DB_BASE_URI || '').replace(/\/+$/, '');
  const uri = `${base}/${encodeURIComponent(centerSlug)}`;
  const conn = mongoose.createConnection(uri, mongooseOptions);
  const pending = conn.asPromise()
    .then(() => {
      logger.info(`✅ DB connected: db_${centerSlug}`);
      return conn;
    })
    .catch((err) => {
      // Don't cache a failure — the next request tries again (and don't leak the half-open one)
      if (connections[centerSlug] === pending) delete connections[centerSlug];
      conn.close().catch(() => {});
      throw err;
    });
  connections[centerSlug] = pending;
  return pending;
};

export const getMasterDb = () => {
  return mongoose.connection;
};

// Close one center's connection (e.g. after its database is purged).
// Other centers' connections — and the schedulers holding them — are untouched.
export const closeConnection = async (centerSlug) => {
  const pending = connections[centerSlug];
  if (!pending) return;
  delete connections[centerSlug];
  try {
    const conn = await pending; // may still be opening — wait, then close it
    await conn.close();
    logger.info(`🔌 DB closed: db_${centerSlug}`);
  } catch { /* never opened, or already closed */ }
};

// Close all per-center connections — call during graceful shutdown
export const closeAllConnections = async () => {
  await Promise.all(Object.keys(connections).map(closeConnection));
};
