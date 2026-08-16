'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES, ROLE_VALUES } = require('../models/constants');

const router = express.Router();

// Entire module is admin-only.
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post(
  '/',
  validate([
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(ROLE_VALUES).withMessage(`role must be one of: ${ROLE_VALUES.join(', ')}`),
  ]),
  controller.create
);

router.put('/:id', controller.update);
router.patch('/:id/status', validate([body('isActive').isBoolean()]), controller.setActive);
router.delete('/:id', controller.remove);

module.exports = router;
