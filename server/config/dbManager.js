import mongoose from 'mongoose';

const connections = {};

const mongooseOptions = {
  maxPoolSize: 5,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

export const getDb = async (centerSlug) => {
  if (connections[centerSlug]) return connections[centerSlug];
  const uri = `${process.env.DB_BASE_URI}/${centerSlug}`;
  const conn = await mongoose.createConnection(uri, mongooseOptions);
  connections[centerSlug] = conn;
  console.log(`✅ DB connected: db_${centerSlug}`);
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
        console.log(`🔌 DB closed: db_${slug}`);
        delete connections[slug];
      }).catch(() => {})
    )
  );
};
