'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/medicalRecord.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES, RECORD_TYPES } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post(
  '/',
  authorize(ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN),
  validate([
    body('patientId').isInt({ min: 1 }).withMessage('patientId is required'),
    body('recordType').optional().isIn(RECORD_TYPES),
    body('pulse').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0, max: 300 }),
    body('temperature').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 25, max: 45 }),
    body('oxygenSaturation')
      .optional({ nullable: true, checkFalsy: true })
      .isInt({ min: 0, max: 100 }),
  ]),
  controller.create
);

router.put('/:id', authorize(ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

module.exports = router;
