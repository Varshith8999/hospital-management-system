'use strict';

const express = require('express');
const controller = require('../controllers/health.controller');

const router = express.Router();

// Public - used by Docker healthchecks and the Jenkins deployment gate.
router.get('/', controller.health);
router.get('/live', controller.live);

module.exports = router;
