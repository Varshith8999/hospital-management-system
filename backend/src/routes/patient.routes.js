'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/patient.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.get('/:id/summary', controller.getSummary);

router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate([
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required'),
    body('phone').trim().isLength({ min: 6, max: 20 }).withMessage('Phone is required'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
    body('dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['Male', 'Female', 'Other']),
    body('password')
      .if(body('createLogin').equals('true'))
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ]),
  controller.create
);

router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.DOCTOR, ROLES.PATIENT),
  validate([
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
    body('phone').optional({ nullable: true, checkFalsy: true }).isLength({ min: 6, max: 20 }),
    body('dateOfBirth').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  ]),
  controller.update
);

router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

module.exports = router;
