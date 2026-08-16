'use strict';

const { Op } = require('sequelize');
const { Bill, Patient, Appointment } = require('../models');
const { ROLES } = require('../models/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, paginatedResponse } = require('../utils/pagination');
const { getAccessiblePatient } = require('../services/access.service');
const billingService = require('../services/billing.service');

const INCLUDES = [
  { model: Patient, as: 'patient', attributes: ['id', 'patientCode', 'fullName', 'phone'] },
  {
    model: Appointment,
    as: 'appointment',
    attributes: ['id', 'appointmentCode', 'appointmentDate', 'appointmentTime'],
    required: false,
  },
];

function billScope(req) {
  if (req.user.role === ROLES.PATIENT) {
    if (!req.patientProfile) throw ApiError.forbidden('No patient profile linked to this account');
    return { patientId: req.patientProfile.id };
  }
  return {};
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = { ...billScope(req) };
  const and = [];

  if (req.query.patientId && req.user.role !== ROLES.PATIENT) {
    and.push({ patientId: req.query.patientId });
  }
  if (req.query.paymentStatus) and.push({ paymentStatus: req.query.paymentStatus });
  if (req.query.search) and.push({ billCode: { [Op.like]: `%${req.query.search}%` } });
  if (and.length) where[Op.and] = and;

  const result = await Bill.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    include: INCLUDES,
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const bill = await Bill.findByPk(req.params.id, { include: INCLUDES });
  if (!bill) throw ApiError.notFound('Bill not found');

  if (req.user.role === ROLES.PATIENT && bill.patientId !== req.patientProfile?.id) {
    throw ApiError.forbidden('You can only view your own bills');
  }

  res.json({ success: true, data: bill });
});

const create = asyncHandler(async (req, res) => {
  if (!req.body.patientId) throw ApiError.badRequest('patientId is required');
  await getAccessiblePatient(req, req.body.patientId);

  const bill = await billingService.createBill(req.body, req.user.id);
  const created = await Bill.findByPk(bill.id, { include: INCLUDES });

  res.status(201).json({ success: true, message: 'Bill created', data: created });
});

const update = asyncHandler(async (req, res) => {
  const bill = await Bill.findByPk(req.params.id);
  if (!bill) throw ApiError.notFound('Bill not found');

  await billingService.updateBill(bill, req.body);
  const updated = await Bill.findByPk(bill.id, { include: INCLUDES });

  res.json({ success: true, message: 'Bill updated', data: updated });
});

const pay = asyncHandler(async (req, res) => {
  const bill = await Bill.findByPk(req.params.id);
  if (!bill) throw ApiError.notFound('Bill not found');

  await billingService.recordPayment(bill, req.body.amount, req.body.paymentMethod);
  const updated = await Bill.findByPk(bill.id, { include: INCLUDES });

  res.json({ success: true, message: 'Payment recorded', data: updated });
});

const remove = asyncHandler(async (req, res) => {
  const bill = await Bill.findByPk(req.params.id);
  if (!bill) throw ApiError.notFound('Bill not found');
  await bill.destroy();
  res.json({ success: true, message: 'Bill deleted' });
});

module.exports = { list, getById, create, update, pay, remove };
