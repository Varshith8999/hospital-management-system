'use strict';

const { sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

const startedAt = Date.now();

/**
 * GET /api/health
 * Used by Docker healthchecks and the Jenkins post-deployment verification.
 * Returns 200 { status: "ok" } only when the database is reachable.
 */
const health = asyncHandler(async (_req, res) => {
  let database = 'down';
  try {
    await sequelize.authenticate();
    database = 'up';
  } catch (_err) {
    database = 'down';
  }

  const ok = database === 'up';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'error',
    service: 'hospital-management-backend',
    version: process.env.APP_VERSION || '1.0.0',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    dependencies: { database },
    timestamp: new Date().toISOString(),
  });
});

/** Lightweight liveness probe that does not touch the database. */
const live = (_req, res) => res.status(200).json({ status: 'ok' });

module.exports = { health, live };
