'use strict';

/**
 * Configuration consumed by sequelize-cli (migrations & seeders).
 * All values come from environment variables - nothing is hard-coded.
 */
require('./index');

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hospital_db',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  dialect: process.env.DB_DIALECT || 'mysql',
  logging: process.env.DB_LOGGING === 'true',
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeSeeds',
};

module.exports = {
  development: base,
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    seederStorage: 'sequelize',
    seederStorageTableName: 'SequelizeSeeds',
  },
  production: base,
};
