'use strict';

const sequelize = require('../config/database');

let sqliteQueue = Promise.resolve();

/**
 * Runs `fn` inside a managed transaction.
 *
 * MySQL gets a normal Sequelize managed transaction. SQLite (used by the test
 * suite) exposes a single writer connection, so two concurrent
 * `sequelize.transaction()` calls interleave their BEGIN/COMMIT statements and
 * both blow up. Serialising them here keeps concurrency behaviour identical
 * across dialects, which is what makes the double-booking race test meaningful.
 */
function withTransaction(fn) {
  if (sequelize.getDialect() !== 'sqlite') {
    return sequelize.transaction(fn);
  }

  const run = sqliteQueue.then(() => sequelize.transaction(fn));
  // Keep the queue alive regardless of whether this transaction succeeded.
  sqliteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

module.exports = { withTransaction };
