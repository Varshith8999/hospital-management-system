'use strict';

/**
 * Generates human-readable business identifiers (PAT-000001, APT-000042, ...).
 * The numeric part is derived from the current max primary key inside the
 * transaction, so codes stay sequential and unique.
 */
async function generateCode(model, prefix, options = {}) {
  const max = await model.max('id', { transaction: options.transaction });
  const next = (Number.isFinite(max) ? max : 0) + 1;
  return `${prefix}-${String(next).padStart(6, '0')}`;
}

/** Fallback used when a code collides (e.g. after a manual insert). */
function randomCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

module.exports = { generateCode, randomCode };
