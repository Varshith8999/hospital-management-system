'use strict';

const { Op } = require('sequelize');
const {
  Doctor,
  User,
  Department,
  Appointment,
  Patient,
} = require('../models');
const { ROLES, APPOINTMENT_STATUS } = require('../models/constants');
const { withTransaction } = require('../utils/transaction');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const { getPagination, paginatedResponse } = require('../utils/pagination');
const appointmentService = require('../services/appointment.service');

const PUBLIC_ATTRIBUTES = [
  'id', 'doctorCode', 'fullName', 'email', 'phone', 'specialization', 'departmentId',
  'experienceYears', 'qualification', 'consultationFee', 'availability', 'isAvailable', 'isActive',
];

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = {};
  const and = [];

  if (req.query.search) {
    const term = `%${req.query.search}%`;
    and.push({
      [Op.or]: [
        { fullName: { [Op.like]: term } },
        { doctorCode: { [Op.like]: term } },
        { specialization: { [Op.like]: term } },
        { email: { [Op.like]: term } },
      ],
    });
  }
  if (req.query.departmentId) and.push({ departmentId: req.query.departmentId });
  if (req.query.specialization) and.push({ specialization: req.query.specialization });
  if (req.query.isAvailable !== undefined) and.push({ isAvailable: req.query.isAvailable === 'true' });

  // Non-staff only ever see active doctors.
  if (req.user.role === ROLES.PATIENT) and.push({ isActive: true });
  else if (req.query.isActive !== undefined) and.push({ isActive: req.query.isActive === 'true' });

  if (and.length) where[Op.and] = and;

  const result = await Doctor.findAndCountAll({
    where,
    limit,
    offset,
    order: [['fullName', 'ASC']],
    attributes: PUBLIC_ATTRIBUTES,
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findByPk(req.params.id, {
    attributes: PUBLIC_ATTRIBUTES,
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
  });
  if (!doctor) throw ApiError.notFound('Doctor not found');
  res.json({ success: true, data: doctor });
});

const create = asyncHandler(async (req, res) => {
  const { fullName, email, password, specialization, departmentId } = req.body;

  if (!fullName || !email || !password || !specialization || !departmentId) {
    throw ApiError.badRequest(
      'fullName, email, password, specialization and departmentId are required'
    );
  }

  const department = await Department.findByPk(departmentId);
  if (!department) throw ApiError.badRequest('Department not found');

  const normalisedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalisedEmail } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const doctor = await withTransaction(async (transaction) => {
    const user = await User.create(
      {
        fullName,
        email: normalisedEmail,
        password,
        phone: req.body.phone || null,
        role: ROLES.DOCTOR,
      },
      { transaction }
    );

    const doctorCode = await generateCode(Doctor, 'DOC', { transaction });
    return Doctor.create(
      {
        doctorCode,
        userId: user.id,
        fullName,
        email: normalisedEmail,
        phone: req.body.phone || null,
        specialization,
        departmentId,
        experienceYears: req.body.experienceYears || 0,
        qualification: req.body.qualification || null,
        consultationFee: req.body.consultationFee || 0,
        availability: req.body.availability || null,
      },
      { transaction }
    );
  });

  res.status(201).json({ success: true, message: 'Doctor created', data: doctor });
});

const update = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findByPk(req.params.id);
  if (!doctor) throw ApiError.notFound('Doctor not found');

  // A doctor may edit their own profile; only an admin may edit anyone's.
  const isSelf = req.doctorProfile && req.doctorProfile.id === doctor.id;
  if (req.user.role !== ROLES.ADMIN && !isSelf) {
    throw ApiError.forbidden('You can only update your own profile');
  }

  const adminFields = ['departmentId', 'isActive', 'consultationFee', 'specialization'];
  const selfFields = [
    'fullName', 'phone', 'qualification', 'experienceYears', 'availability', 'isAvailable',
  ];
  const allowed = req.user.role === ROLES.ADMIN ? [...adminFields, ...selfFields] : selfFields;

  if (req.body.departmentId !== undefined && req.user.role === ROLES.ADMIN) {
    const department = await Department.findByPk(req.body.departmentId);
    if (!department) throw ApiError.badRequest('Department not found');
  }

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) doctor[field] = req.body[field];
  });

  await doctor.save();

  if (req.body.fullName || req.body.phone) {
    await User.update(
      {
        ...(req.body.fullName ? { fullName: req.body.fullName } : {}),
        ...(req.body.phone ? { phone: req.body.phone } : {}),
      },
      { where: { id: doctor.userId } }
    );
  }

  res.json({ success: true, message: 'Doctor updated', data: doctor });
});

const remove = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findByPk(req.params.id);
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const activeAppointments = await Appointment.count({
    where: {
      doctorId: doctor.id,
      status: { [Op.in]: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
    },
  });
  if (activeAppointments > 0) {
    throw ApiError.conflict(
      `Cannot delete: this doctor has ${activeAppointments} active appointment(s). Cancel or reassign them first.`
    );
  }

  const historicAppointments = await Appointment.count({ where: { doctorId: doctor.id } });
  if (historicAppointments > 0) {
    doctor.isActive = false;
    doctor.isAvailable = false;
    await doctor.save();
    await User.update({ isActive: false }, { where: { id: doctor.userId } });
    return res.json({
      success: true,
      message: 'Doctor has appointment history and was deactivated instead of deleted',
      data: doctor,
    });
  }

  const userId = doctor.userId;
  await doctor.destroy();
  await User.destroy({ where: { id: userId } });
  return res.json({ success: true, message: 'Doctor deleted' });
});

/** Patients assigned to the authenticated doctor (derived from appointments). */
const myPatients = asyncHandler(async (req, res) => {
  if (!req.doctorProfile) throw ApiError.forbidden('No doctor profile linked to this account');
  const { page, limit, offset } = getPagination(req.query);

  const where = { doctorId: req.doctorProfile.id };
  const patientWhere = {};
  if (req.query.search) {
    const term = `%${req.query.search}%`;
    patientWhere[Op.or] = [
      { fullName: { [Op.like]: term } },
      { patientCode: { [Op.like]: term } },
      { phone: { [Op.like]: term } },
    ];
  }

  const result = await Appointment.findAndCountAll({
    where,
    attributes: ['patientId'],
    group: ['patientId', 'patient.id'],
    include: [{ model: Patient, as: 'patient', where: patientWhere, required: true }],
    limit,
    offset,
    subQuery: false,
  });

  const rows = result.rows.map((row) => row.patient);
  res.json({
    success: true,
    ...paginatedResponse({ count: result.count, rows }, { page, limit }),
  });
});

const slots = asyncHandler(async (req, res) => {
  const data = await appointmentService.availableSlots(req.params.id, req.query.date);
  res.json({ success: true, data });
});

module.exports = { list, getById, create, update, remove, myPatients, slots };
