import dotenv from "dotenv";
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI', 'EMAIL_USER', 'EMAIL_PASSWORD', 'MASTER_DB_URI', 'DB_BASE_URI'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
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
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  
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