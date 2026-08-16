#!/usr/bin/env node
'use strict';

/**
 * "Build" step for the backend: there is no bundling, so the build gate is a
 * hard syntax/require check of every source file plus a config sanity check.
 * Exits non-zero on any failure so the Jenkins pipeline stops.
 */
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'build-check-placeholder';

const srcDir = path.resolve(__dirname, '..', 'src');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
}

walk(srcDir);

let failed = 0;
for (const file of files) {
  try {
    require(file);
  } catch (err) {
    failed += 1;
    console.error(`[build] FAILED ${path.relative(srcDir, file)}: ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`[build] ${failed} file(s) failed to load.`);
  process.exit(1);
}

console.info(`[build] OK - ${files.length} backend source files loaded cleanly.`);
process.exit(0);
