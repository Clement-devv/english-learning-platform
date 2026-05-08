import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Always load .env from the server/ directory, regardless of where Node is started from
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI', 'MASTER_DB_URI', 'DB_BASE_URI', 'ENCRYPTION_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  if (missingEnvVars.includes('ENCRYPTION_KEY')) {
    console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  process.exit(1);
}

// Validate ENCRYPTION_KEY is exactly 64 hex characters (32 bytes for AES-256)
if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
  console.error('❌ ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with:');
  console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Validate MongoDB URIs have credentials in production
// A URI with auth looks like: mongodb://user:pass@host/db?authSource=admin
// URIs without @ have no credentials and are unsafe outside localhost dev.
const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const isTest       = process.env.NODE_ENV === 'test';
if (!isTest) {
  const mongoUris = [
    { name: 'MONGO_URI',     value: process.env.MONGO_URI     },
    { name: 'MASTER_DB_URI', value: process.env.MASTER_DB_URI },
    { name: 'DB_BASE_URI',   value: process.env.DB_BASE_URI   },
  ];
  const unauthenticated = mongoUris.filter(u => !u.value.includes('@'));
  if (unauthenticated.length > 0) {
    const names = unauthenticated.map(u => u.name).join(', ');
    if (isProduction) {
      console.error(`❌ MongoDB URIs must include credentials in production: ${names}`);
      console.error('   Use: mongodb://user:password@host:27017/db?authSource=admin');
      process.exit(1);
    } else {
      console.warn(`⚠️  MongoDB URIs have no credentials (${names}). This is only safe on localhost.`);
      console.warn('   In production use: mongodb://user:password@host:27017/db?authSource=admin');
    }
  }
}

// Validate JWT secret strength
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}
const _jwtUniqueChars = new Set(process.env.JWT_SECRET).size;
if (_jwtUniqueChars < 8) {
  console.error('❌ JWT_SECRET has insufficient entropy (too many repeated characters). Use a random secret.');
  process.exit(1);
}

export const config = {
  // Server
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: (() => {
    const env = process.env.NODE_ENV || 'development';
    if (!process.env.NODE_ENV) {
      console.warn('⚠️  NODE_ENV not set — defaulting to "development". Set NODE_ENV=production in production.');
    }
    return env;
  })(),
  
  // Database
  mongoUri: process.env.MONGO_URI,
  masterDbUri: process.env.MASTER_DB_URI,
  dbBaseUri:   process.env.DB_BASE_URI,
  
  // Security
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: process.env.JWT_EXPIRY || '15m',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  encryptionKey: process.env.ENCRYPTION_KEY,
  
  // Password requirements
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: true,

  // Email configuration
  emailHost: process.env.EMAIL_HOST || "smtp.gmail.com",
  emailPort: parseInt(process.env.EMAIL_PORT) || 587,
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER,

  // App configuration
  appName: process.env.APP_NAME || "English Learning Platform",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  
  // CORS
  corsOrigins: (() => {
    if (process.env.CORS_ORIGINS) return process.env.CORS_ORIGINS.split(',');
    if ((process.env.NODE_ENV || 'development') === 'production') {
      console.error('❌ CORS_ORIGINS must be set explicitly in production');
      process.exit(1);
    }
    return ['http://localhost:5173', 'http://localhost:3000'];
  })(),
  
  // Agora
  agora: (() => {
    if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
      console.warn('⚠️  AGORA_APP_ID or AGORA_APP_CERTIFICATE not set — video calls will be disabled');
    }
    return {
      appId: process.env.AGORA_APP_ID,
      certificate: process.env.AGORA_APP_CERTIFICATE,
    };
  })(),
  
  // Security
  trustProxy: process.env.TRUST_PROXY === 'true',

  // Multi-tenancy
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
  cdnBaseUrl:      process.env.CDN_BASE_URL || '',
  serverIp:        process.env.SERVER_IP || null,
};

export default config;

// Standard JWT claims added to every token.
// iss (issuer)  — identifies this platform as the token origin
// aud (audience) — restricts the token to this platform's API
export const JWT_STANDARD_CLAIMS = {
  iss: 'english-learning-platform',
  aud: 'elp-api',
};