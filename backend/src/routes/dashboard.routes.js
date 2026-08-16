'use strict';

const express = require('express');
const controller = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', authenticate, controller.summary);

module.exports = router;
