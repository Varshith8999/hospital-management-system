'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/nurse.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES, SHIFTS } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE), controller.list);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE), controller.getById);

router.post(
  '/',
  authorize(ROLES.ADMIN),
  validate([
    body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('shift').optional().isIn(SHIFTS),
    body('departmentId').optional({ nullable: true }).isInt({ min: 1 }),
  ]),
  controller.create
);

router.put('/:id', authorize(ROLES.ADMIN, ROLES.NURSE), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

module.exports = router;
