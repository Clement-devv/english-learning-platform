import mongoose from 'mongoose';
import logger from "../utils/logger.js";

const connections = {};

const mongooseOptions = {
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

// Strict allowlist: lowercase letters, digits, hyphens only (no dots, slashes, query chars)
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/;

export const getDb = async (centerSlug) => {
  if (!SLUG_RE.test(centerSlug)) {
    throw new Error(`Invalid center slug: "${centerSlug}"`);
  }
  if (connections[centerSlug]) return connections[centerSlug];
  const uri = `${process.env.DB_BASE_URI}/${encodeURIComponent(centerSlug)}`;
  const conn = await mongoose.createConnection(uri, mongooseOptions);
  connections[centerSlug] = conn;
  logger.info(`✅ DB connected: db_${centerSlug}`);
  return conn;
};

export const getMasterDb = () => {
  return mongoose.connection;
};

// Close all per-center connections — call during graceful shutdown
export const closeAllConnections = async () => {
  const slugs = Object.keys(connections);
  await Promise.all(
    slugs.map(slug =>
      connections[slug].close().then(() => {
        logger.info(`🔌 DB closed: db_${slug}`);
        delete connections[slug];
      }).catch(() => {})
    )
  );
};
