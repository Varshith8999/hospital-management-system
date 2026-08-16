'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/bill.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES, PAYMENT_STATUS_VALUES } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);

const chargeValidators = [
  'consultationCharges',
  'medicineCharges',
  'testCharges',
  'roomCharges',
  'otherCharges',
  'amountPaid',
].map((field) => body(field).optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }));

router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate([
    body('patientId').isInt({ min: 1 }).withMessage('patientId is required'),
    ...chargeValidators,
  ]),
  controller.create
);

router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate([
    ...chargeValidators,
    body('paymentStatus').optional().isIn(PAYMENT_STATUS_VALUES),
  ]),
  controller.update
);

router.patch(
  '/:id/pay',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate([body('amount').isFloat({ gt: 0 }).withMessage('A positive amount is required')]),
  controller.pay
);

router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

module.exports = router;
