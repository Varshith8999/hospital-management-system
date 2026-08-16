'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/prescription.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post(
  '/',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate([
    body('patientId').isInt({ min: 1 }).withMessage('patientId is required'),
    body('medicine').trim().notEmpty().withMessage('medicine is required'),
    body('dosage').trim().notEmpty().withMessage('dosage is required'),
    body('frequency').trim().notEmpty().withMessage('frequency is required'),
    body('duration').trim().notEmpty().withMessage('duration is required'),
  ]),
  controller.create
);

router.put('/:id', authorize(ROLES.DOCTOR, ROLES.ADMIN), controller.update);
router.delete('/:id', authorize(ROLES.DOCTOR, ROLES.ADMIN), controller.remove);

module.exports = router;
