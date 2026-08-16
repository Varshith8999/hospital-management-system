'use strict';

const { Op } = require('sequelize');
const {
  Patient,
  User,
  Appointment,
  MedicalRecord,
  Prescription,
  Bill,
  Doctor,
  Department,
} = require('../models');
const { ROLES } = require('../models/constants');
const { withTransaction } = require('../utils/transaction');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const { getPagination, paginatedResponse } = require('../utils/pagination');
const { patientScope, getAccessiblePatient } = require('../services/access.service');

/** Fields each role is allowed to write. Anything else is silently ignored. */
const WRITABLE_FIELDS = {
  [ROLES.ADMIN]: [
    'fullName', 'dateOfBirth', 'gender', 'phone', 'email', 'address', 'bloodGroup',
    'emergencyContactName', 'emergencyContactPhone', 'medicalHistory', 'allergies', 'isActive',
  ],
  [ROLES.RECEPTIONIST]: [
    'fullName', 'dateOfBirth', 'gender', 'phone', 'email', 'address', 'bloodGroup',
    'emergencyContactName', 'emergencyContactPhone',
  ],
  [ROLES.NURSE]: [
    'phone', 'address', 'bloodGroup', 'emergencyContactName', 'emergencyContactPhone', 'allergies',
  ],
  [ROLES.DOCTOR]: ['medicalHistory', 'allergies', 'bloodGroup'],
  [ROLES.PATIENT]: [
    'fullName', 'dateOfBirth', 'gender', 'phone', 'email', 'address', 'bloodGroup',
    'emergencyContactName', 'emergencyContactPhone', 'allergies',
  ],
};

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = { ...patientScope(req) };
  const and = [];

  if (req.query.search) {
    const term = `%${req.query.search}%`;
    and.push({
      [Op.or]: [
        { fullName: { [Op.like]: term } },
        { patientCode: { [Op.like]: term } },
        { phone: { [Op.like]: term } },
        { email: { [Op.like]: term } },
      ],
    });
  }
  if (req.query.gender) and.push({ gender: req.query.gender });
  if (req.query.bloodGroup) and.push({ bloodGroup: req.query.bloodGroup });
  if (req.query.isActive !== undefined) and.push({ isActive: req.query.isActive === 'true' });
  if (and.length) where[Op.and] = and;

  const result = await Patient.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'user', attributes: ['id', 'email', 'isActive'], required: false }],
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const patient = await getAccessiblePatient(req, req.params.id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'email', 'isActive'], required: false }],
  });
  res.json({ success: true, data: { ...patient.toJSON(), age: patient.age } });
});

/** Full clinical view: appointments, records, prescriptions and bills. */
const getSummary = asyncHandler(async (req, res) => {
  const patient = await getAccessiblePatient(req, req.params.id);

  const [appointments, records, prescriptions, bills] = await Promise.all([
    Appointment.findAll({
      where: { patientId: patient.id },
      order: [['appointmentDate', 'DESC'], ['appointmentTime', 'DESC']],
      limit: 20,
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'fullName', 'specialization'] },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
      ],
    }),
    MedicalRecord.findAll({
      where: { patientId: patient.id },
      order: [['recordDate', 'DESC']],
      limit: 20,
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'fullName'] }],
    }),
    Prescription.findAll({
      where: { patientId: patient.id },
      order: [['prescriptionDate', 'DESC']],
      limit: 20,
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'fullName'] }],
    }),
    Bill.findAll({ where: { patientId: patient.id }, order: [['createdAt', 'DESC']], limit: 20 }),
  ]);

  res.json({
    success: true,
    data: {
      patient: { ...patient.toJSON(), age: patient.age },
      appointments,
      medicalRecords: records,
      prescriptions,
      bills,
    },
  });
});

const create = asyncHandler(async (req, res) => {
  const { fullName, phone } = req.body;
  if (!fullName || !phone) throw ApiError.badRequest('fullName and phone are required');

  const patient = await withTransaction(async (transaction) => {
    let userId = null;

    // Optionally provision a login for the patient.
    if (req.body.createLogin && req.body.email && req.body.password) {
      const email = String(req.body.email).trim().toLowerCase();
      const existing = await User.findOne({ where: { email }, transaction });
      if (existing) throw ApiError.conflict('A user with this email already exists');

      const user = await User.create(
        {
          fullName,
          email,
          password: req.body.password,
          phone,
          role: ROLES.PATIENT,
        },
        { transaction }
      );
      userId = user.id;
    }

    const patientCode = await generateCode(Patient, 'PAT', { transaction });
    return Patient.create(
      {
        patientCode,
        userId,
        fullName,
        phone,
        email: req.body.email || null,
        dateOfBirth: req.body.dateOfBirth || null,
        gender: req.body.gender || null,
        address: req.body.address || null,
        bloodGroup: req.body.bloodGroup || 'Unknown',
        emergencyContactName: req.body.emergencyContactName || null,
        emergencyContactPhone: req.body.emergencyContactPhone || null,
        medicalHistory: req.body.medicalHistory || null,
        allergies: req.body.allergies || null,
      },
      { transaction }
    );
  });

  res.status(201).json({ success: true, message: 'Patient created', data: patient });
});

const update = asyncHandler(async (req, res) => {
  const patient = await getAccessiblePatient(req, req.params.id);
  const allowed = WRITABLE_FIELDS[req.user.role] || [];

  const applied = [];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      patient[field] = req.body[field];
      applied.push(field);
    }
  });

  if (!applied.length) {
    throw ApiError.badRequest(
      `No updatable fields supplied. Your role may update: ${allowed.join(', ')}`
    );
  }

  await patient.save();
  res.json({ success: true, message: 'Patient updated', data: patient });
});

/**
 * Admin-only. Patients with clinical history are deactivated rather than
 * destroyed so appointments, records and bills keep their references.
 */
const remove = asyncHandler(async (req, res) => {
  const patient = await Patient.findByPk(req.params.id);
  if (!patient) throw ApiError.notFound('Patient not found');

  const [appointments, records, bills] = await Promise.all([
    Appointment.count({ where: { patientId: patient.id } }),
    MedicalRecord.count({ where: { patientId: patient.id } }),
    Bill.count({ where: { patientId: patient.id } }),
  ]);

  if (appointments + records + bills > 0) {
    patient.isActive = false;
    await patient.save();
    if (patient.userId) {
      await User.update({ isActive: false }, { where: { id: patient.userId } });
    }
    return res.json({
      success: true,
      message: 'Patient has clinical history and was deactivated instead of deleted',
      data: patient,
    });
  }

  const userId = patient.userId;
  await patient.destroy();
  if (userId) await User.destroy({ where: { id: userId } });

  return res.json({ success: true, message: 'Patient deleted' });
});

module.exports = { list, getById, getSummary, create, update, remove };
