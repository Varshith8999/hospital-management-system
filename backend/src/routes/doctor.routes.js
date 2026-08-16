'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/doctor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

// Any authenticated user may browse doctors (patients need this to book).
router.get('/', controller.list);
router.get('/me/patients', authorize(ROLES.DOCTOR), controller.myPatients);
router.get('/:id', controller.getById);
router.get('/:id/slots', controller.slots);

router.post(
  '/',
  authorize(ROLES.ADMIN),
  validate([
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('specialization').trim().notEmpty().withMessage('Specialization is required'),
    body('departmentId').isInt({ min: 1 }).withMessage('departmentId is required'),
    body('experienceYears').optional().isInt({ min: 0, max: 70 }),
    body('consultationFee').optional().isFloat({ min: 0 }),
  ]),
  controller.create
);

router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  validate([
    body('experienceYears').optional().isInt({ min: 0, max: 70 }),
    body('consultationFee').optional().isFloat({ min: 0 }),
    body('departmentId').optional().isInt({ min: 1 }),
  ]),
  controller.update
);

router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

module.exports = router;
