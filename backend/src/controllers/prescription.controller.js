'use strict';

const { Op } = require('sequelize');
const { Prescription, Patient, Doctor, Appointment } = require('../models');
const { ROLES } = require('../models/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const { getPagination, paginatedResponse } = require('../utils/pagination');
const { getAccessiblePatient, ownRecordsScope } = require('../services/access.service');

const INCLUDES = [
  { model: Patient, as: 'patient', attributes: ['id', 'patientCode', 'fullName'] },
  { model: Doctor, as: 'doctor', attributes: ['id', 'fullName', 'specialization'] },
];

const EDITABLE = ['medicine', 'dosage', 'frequency', 'duration', 'instructions', 'isActive'];

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = { ...ownRecordsScope(req) };
  const and = [];

  if (req.query.patientId) {
    await getAccessiblePatient(req, req.query.patientId);
    and.push({ patientId: req.query.patientId });
  }
  if (req.query.doctorId) and.push({ doctorId: req.query.doctorId });
  if (req.query.isActive !== undefined) and.push({ isActive: req.query.isActive === 'true' });
  if (req.query.search) {
    const term = `%${req.query.search}%`;
    and.push({
      [Op.or]: [{ medicine: { [Op.like]: term } }, { prescriptionCode: { [Op.like]: term } }],
    });
  }
  if (and.length) where[Op.and] = and;

  const result = await Prescription.findAndCountAll({
    where,
    limit,
    offset,
    order: [['prescriptionDate', 'DESC'], ['id', 'DESC']],
    include: INCLUDES,
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findByPk(req.params.id, { include: INCLUDES });
  if (!prescription) throw ApiError.notFound('Prescription not found');
  await getAccessiblePatient(req, prescription.patientId);
  res.json({ success: true, data: prescription });
});

const create = asyncHandler(async (req, res) => {
  const { patientId, medicine, dosage, frequency, duration } = req.body;

  if (!patientId || !medicine || !dosage || !frequency || !duration) {
    throw ApiError.badRequest(
      'patientId, medicine, dosage, frequency and duration are required'
    );
  }

  const patient = await getAccessiblePatient(req, patientId);

  let doctorId;
  if (req.user.role === ROLES.DOCTOR) {
    if (!req.doctorProfile) throw ApiError.forbidden('No doctor profile linked to this account');
    doctorId = req.doctorProfile.id;
  } else {
    if (!req.body.doctorId) throw ApiError.badRequest('doctorId is required');
    const doctor = await Doctor.findByPk(req.body.doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    doctorId = doctor.id;
  }

  if (req.body.appointmentId) {
    const appointment = await Appointment.findByPk(req.body.appointmentId);
    if (!appointment) throw ApiError.notFound('Appointment not found');
    if (appointment.patientId !== patient.id) {
      throw ApiError.badRequest('Appointment does not belong to this patient');
    }
  }

  const prescription = await Prescription.create({
    prescriptionCode: await generateCode(Prescription, 'PRE', {}),
    patientId: patient.id,
    doctorId,
    appointmentId: req.body.appointmentId || null,
    medicalRecordId: req.body.medicalRecordId || null,
    medicine,
    dosage,
    frequency,
    duration,
    instructions: req.body.instructions || null,
    prescriptionDate: req.body.prescriptionDate || new Date().toISOString().slice(0, 10),
  });

  const created = await Prescription.findByPk(prescription.id, { include: INCLUDES });
  res.status(201).json({ success: true, message: 'Prescription created', data: created });
});

const update = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findByPk(req.params.id);
  if (!prescription) throw ApiError.notFound('Prescription not found');

  if (
    req.user.role === ROLES.DOCTOR &&
    prescription.doctorId !== req.doctorProfile?.id
  ) {
    throw ApiError.forbidden('You can only edit prescriptions you issued');
  }

  let touched = false;
  EDITABLE.forEach((field) => {
    if (req.body[field] !== undefined) {
      prescription[field] = req.body[field];
      touched = true;
    }
  });
  if (!touched) throw ApiError.badRequest('No updatable fields supplied');

  await prescription.save();
  res.json({ success: true, message: 'Prescription updated', data: prescription });
});

const remove = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findByPk(req.params.id);
  if (!prescription) throw ApiError.notFound('Prescription not found');

  if (
    req.user.role === ROLES.DOCTOR &&
    prescription.doctorId !== req.doctorProfile?.id
  ) {
    throw ApiError.forbidden('You can only delete prescriptions you issued');
  }

  await prescription.destroy();
  res.json({ success: true, message: 'Prescription deleted' });
});

module.exports = { list, getById, create, update, remove };
