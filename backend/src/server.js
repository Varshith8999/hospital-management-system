'use strict';

const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');

const MAX_DB_ATTEMPTS = parseInt(process.env.DB_CONNECT_RETRIES || '15', 10);
const RETRY_DELAY_MS = parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || '3000', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** MySQL in Docker takes a few seconds to accept connections - retry instead of crashing. */
async function connectWithRetry() {
  for (let attempt = 1; attempt <= MAX_DB_ATTEMPTS; attempt += 1) {
    try {
      await sequelize.authenticate();
      console.info(`[db] Connected to ${config.db.dialect} database "${config.db.name}"`);
      return;
    } catch (err) {
      console.warn(
        `[db] Connection attempt ${attempt}/${MAX_DB_ATTEMPTS} failed: ${err.message}`
      );
      if (attempt === MAX_DB_ATTEMPTS) throw err;
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function start() {
  await connectWithRetry();

  // Opt-in convenience for local development only; production uses migrations.
  if (process.env.DB_SYNC === 'true') {
    await sequelize.sync({ alter: true });
    console.info('[db] Schema synchronised (DB_SYNC=true)');
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.info(`[api] Listening on port ${config.port} in ${config.env} mode`);
  });

  const shutdown = (signal) => {
    console.info(`[api] ${signal} received, shutting down gracefully`);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  console.error('[api] Unhandled rejection:', reason);
});

start().catch((err) => {
  console.error('[api] Failed to start:', err.message);
  process.exit(1);
});
