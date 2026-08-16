'use strict';

const { Op } = require('sequelize');
const { MedicalRecord, Patient, Doctor, Nurse, Appointment } = require('../models');
const { ROLES } = require('../models/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const { getPagination, paginatedResponse } = require('../utils/pagination');
const { getAccessiblePatient, ownRecordsScope } = require('../services/access.service');

const INCLUDES = [
  { model: Patient, as: 'patient', attributes: ['id', 'patientCode', 'fullName'] },
  { model: Doctor, as: 'doctor', attributes: ['id', 'fullName', 'specialization'] },
  { model: Nurse, as: 'nurse', attributes: ['id', 'fullName'] },
];

const CLINICAL_FIELDS = ['diagnosis', 'symptoms', 'treatment', 'notes'];
const VITALS_FIELDS = [
  'bloodPressure', 'temperature', 'pulse', 'respirationRate',
  'oxygenSaturation', 'weightKg', 'heightCm',
];

/** Nurses may only touch vitals + notes; doctors may write the full record. */
function writableFields(role) {
  if (role === ROLES.NURSE) return [...VITALS_FIELDS, 'notes'];
  if (role === ROLES.DOCTOR || role === ROLES.ADMIN) return [...CLINICAL_FIELDS, ...VITALS_FIELDS];
  return [];
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = { ...ownRecordsScope(req) };
  const and = [];

  if (req.query.patientId) {
    await getAccessiblePatient(req, req.query.patientId);
    and.push({ patientId: req.query.patientId });
  }
  if (req.query.recordType) and.push({ recordType: req.query.recordType });
  if (req.query.from) and.push({ recordDate: { [Op.gte]: `${req.query.from} 00:00:00` } });
  if (req.query.to) and.push({ recordDate: { [Op.lte]: `${req.query.to} 23:59:59` } });
  if (req.query.search) {
    const term = `%${req.query.search}%`;
    and.push({
      [Op.or]: [
        { diagnosis: { [Op.like]: term } },
        { symptoms: { [Op.like]: term } },
        { recordCode: { [Op.like]: term } },
      ],
    });
  }
  if (and.length) where[Op.and] = and;

  const result = await MedicalRecord.findAndCountAll({
    where,
    limit,
    offset,
    order: [['recordDate', 'DESC']],
    include: INCLUDES,
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findByPk(req.params.id, { include: INCLUDES });
  if (!record) throw ApiError.notFound('Medical record not found');

  // Reuse patient scoping so patients only ever see their own records.
  await getAccessiblePatient(req, record.patientId);

  res.json({ success: true, data: record });
});

const create = asyncHandler(async (req, res) => {
  const { patientId } = req.body;
  if (!patientId) throw ApiError.badRequest('patientId is required');

  const patient = await getAccessiblePatient(req, patientId);

  if (req.body.appointmentId) {
    const appointment = await Appointment.findByPk(req.body.appointmentId);
    if (!appointment) throw ApiError.notFound('Appointment not found');
    if (appointment.patientId !== patient.id) {
      throw ApiError.badRequest('Appointment does not belong to this patient');
    }
  }

  const isNurse = req.user.role === ROLES.NURSE;
  const allowed = writableFields(req.user.role);
  if (!allowed.length) throw ApiError.forbidden('Your role cannot create medical records');

  const payload = {
    recordCode: await generateCode(MedicalRecord, 'REC', {}),
    patientId: patient.id,
    doctorId: isNurse ? req.body.doctorId || null : req.doctorProfile?.id || req.body.doctorId || null,
    nurseId: isNurse ? req.nurseProfile.id : null,
    appointmentId: req.body.appointmentId || null,
    recordType: req.body.recordType || (isNurse ? 'Vitals' : 'Consultation'),
    recordDate: req.body.recordDate || new Date(),
  };

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  });

  if (!isNurse && !payload.diagnosis && !payload.symptoms && !payload.notes) {
    throw ApiError.badRequest('At least one of diagnosis, symptoms or notes is required');
  }

  const record = await MedicalRecord.create(payload);
  const created = await MedicalRecord.findByPk(record.id, { include: INCLUDES });

  res.status(201).json({ success: true, message: 'Medical record created', data: created });
});

const update = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findByPk(req.params.id);
  if (!record) throw ApiError.notFound('Medical record not found');

  await getAccessiblePatient(req, record.patientId);

  const role = req.user.role;
  if (role === ROLES.DOCTOR && record.doctorId !== req.doctorProfile?.id) {
    throw ApiError.forbidden('You can only edit records you authored');
  }
  if (role === ROLES.NURSE && record.nurseId !== req.nurseProfile?.id) {
    throw ApiError.forbidden('You can only edit notes you recorded');
  }

  const allowed = writableFields(role);
  if (!allowed.length) throw ApiError.forbidden('Your role cannot edit medical records');

  let touched = false;
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      record[field] = req.body[field];
      touched = true;
    }
  });
  if (!touched) throw ApiError.badRequest('No updatable fields supplied');

  await record.save();
  res.json({ success: true, message: 'Medical record updated', data: record });
});

const remove = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findByPk(req.params.id);
  if (!record) throw ApiError.notFound('Medical record not found');
  await record.destroy();
  res.json({ success: true, message: 'Medical record deleted' });
});

module.exports = { list, getById, create, update, remove };
