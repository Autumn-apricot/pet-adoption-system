const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pet_adoption',
    connectionLimit: toInt(process.env.DB_POOL_LIMIT, 10),
    waitForConnections: true,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
    timezone: '+08:00',
    decimalNumbers: true,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),

  pagination: {
    defaultSize: toInt(process.env.PAGE_SIZE, 10),
    maxSize: toInt(process.env.PAGE_SIZE_MAX, 100),
  },
};

if (config.env === 'production' && !process.env.JWT_SECRET) {
  throw new Error('生产环境必须通过环境变量 JWT_SECRET 显式配置签名密钥');
}

module.exports = config;
