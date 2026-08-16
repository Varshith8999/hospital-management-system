'use strict';

const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/department.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { ROLES } = require('../models/constants');

const router = express.Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post(
  '/',
  authorize(ROLES.ADMIN),
  validate([
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Department name is required'),
    body('phone').optional({ nullable: true, checkFalsy: true }).isLength({ min: 6, max: 20 }),
  ]),
  controller.create
);

router.put('/:id', authorize(ROLES.ADMIN), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

module.exports = router;
