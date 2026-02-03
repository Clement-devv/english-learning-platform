// test-config.js
import { config } from './config/config.js';

console.log('📋 Configuration Check:');
console.log('Port:', config.port);
console.log('MongoDB:', config.mongoUri ? '✓' : '✗');
console.log('JWT Secret:', config.jwtSecret.length, 'chars');
console.log('Email User:', config.emailUser);
console.log('Email Host:', config.emailHost);
console.log('Frontend URL:', config.frontendUrl);
console.log('CORS Origins:', config.corsOrigins);