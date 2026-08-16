'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/appointment.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post(
  '/',
  authorize(ROLES.PATIENT, ROLES.RECEPTIONIST, ROLES.ADMIN),
  validate([
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    body('appointmentDate').isISO8601().withMessage('appointmentDate must be YYYY-MM-DD'),
    body('appointmentTime')
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage('appointmentTime must be HH:MM (24-hour)'),
    body('reason').trim().isLength({ min: 3 }).withMessage('A reason is required'),
  ]),
  controller.book
);

router.patch('/:id/confirm', authorize(ROLES.DOCTOR, ROLES.ADMIN), controller.confirm);
router.patch('/:id/reject', authorize(ROLES.DOCTOR, ROLES.ADMIN), controller.reject);
router.patch('/:id/complete', authorize(ROLES.DOCTOR, ROLES.ADMIN), controller.complete);

router.patch(
  '/:id/cancel',
  authorize(ROLES.PATIENT, ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.DOCTOR),
  controller.cancel
);

router.patch(
  '/:id/reschedule',
  authorize(ROLES.PATIENT, ROLES.RECEPTIONIST, ROLES.ADMIN),
  validate([
    body('appointmentDate').optional().isISO8601(),
    body('appointmentTime')
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage('appointmentTime must be HH:MM (24-hour)'),
  ]),
  controller.reschedule
);

router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR),
  controller.update
);

module.exports = router;
