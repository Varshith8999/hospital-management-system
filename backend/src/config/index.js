'use strict';

const path = require('path');
const dotenv = require('dotenv');

// Load .env from the backend folder, then fall back to the repository root.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const env = process.env.NODE_ENV || 'development';
const isTest = env === 'test';

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    // Never fail hard during tests / lint; fail hard for real runtimes.
    if (isTest) return `test-${name.toLowerCase()}`;
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for the full list.`
    );
  }
  return value;
}

const config = {
  env,
  isTest,
  isProduction: env === 'production',
  port: parseInt(process.env.PORT || '5000', 10),
  corsOrigin: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  db: {
    dialect: isTest ? 'sqlite' : process.env.DB_DIALECT || 'mysql',
    storage: ':memory:',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'hospital_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: process.env.DB_LOGGING === 'true',
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || required('JWT_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || (isTest ? '4' : '10'), 10),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
    // Stricter budget for the credential endpoints (brute-force protection).
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  },
};

module.exports = config;
