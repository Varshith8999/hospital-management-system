'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-used-in-production';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.BCRYPT_ROUNDS = '4';
process.env.DB_DIALECT = 'sqlite';

const { sequelize } = require('../src/models');

// Every test file gets its own in-memory SQLite database.
beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});
