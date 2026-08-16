'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const controller = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const config = require('../config');

const router = express.Router();

// Brute-force protection on the credential endpoints.
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.isTest ? 10000 : config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

const passwordRule = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must contain a letter')
  .matches(/\d/)
  .withMessage('Password must contain a number');

router.post(
  '/register',
  authLimiter,
  validate([
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    passwordRule,
    body('phone').optional({ nullable: true, checkFalsy: true }).isLength({ min: 6, max: 20 }),
    body('dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['Male', 'Female', 'Other']),
  ]),
  controller.register
);

router.post(
  '/login',
  authLimiter,
  validate([
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  controller.login
);

router.post('/refresh', validate([body('refreshToken').notEmpty()]), controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

router.patch(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ]),
  controller.changePassword
);

module.exports = router;
