'use strict';

const { Op } = require('sequelize');
const { Appointment, Patient, Doctor, Department } = require('../models');
const { ROLES, APPOINTMENT_STATUS } = require('../models/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, paginatedResponse } = require('../utils/pagination');
const appointmentService = require('../services/appointment.service');

const INCLUDES = [
  {
    model: Patient,
    as: 'patient',
    attributes: ['id', 'patientCode', 'fullName', 'phone', 'gender', 'bloodGroup'],
  },
  {
    model: Doctor,
    as: 'doctor',
    attributes: ['id', 'doctorCode', 'fullName', 'specialization', 'consultationFee'],
  },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
];

/** Restricts the appointment list to what the caller's role may see. */
function roleScope(req) {
  switch (req.user.role) {
    case ROLES.ADMIN:
    case ROLES.RECEPTIONIST:
      return {};
    case ROLES.DOCTOR:
      if (!req.doctorProfile) throw ApiError.forbidden('No doctor profile linked to this account');
      return { doctorId: req.doctorProfile.id };
    case ROLES.NURSE:
      if (!req.nurseProfile) throw ApiError.forbidden('No nurse profile linked to this account');
      return req.nurseProfile.departmentId ? { departmentId: req.nurseProfile.departmentId } : {};
    case ROLES.PATIENT:
      if (!req.patientProfile) throw ApiError.forbidden('No patient profile linked to this account');
      return { patientId: req.patientProfile.id };
    default:
      throw ApiError.forbidden();
  }
}

async function loadScopedAppointment(req, id) {
  const appointment = await Appointment.findByPk(id, { include: INCLUDES });
  if (!appointment) throw ApiError.notFound('Appointment not found');

  const scope = roleScope(req);
  const mismatch = Object.entries(scope).some(([key, value]) => appointment[key] !== value);
  if (mismatch) throw ApiError.forbidden('You do not have access to this appointment');

  return appointment;
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = { ...roleScope(req) };
  const and = [];

  if (req.query.status) and.push({ status: req.query.status });
  if (req.query.doctorId && req.user.role !== ROLES.DOCTOR) {
    and.push({ doctorId: req.query.doctorId });
  }
  if (req.query.patientId && req.user.role !== ROLES.PATIENT) {
    and.push({ patientId: req.query.patientId });
  }
  if (req.query.departmentId) and.push({ departmentId: req.query.departmentId });
  if (req.query.date) and.push({ appointmentDate: req.query.date });
  if (req.query.from) and.push({ appointmentDate: { [Op.gte]: req.query.from } });
  if (req.query.to) and.push({ appointmentDate: { [Op.lte]: req.query.to } });
  if (req.query.upcoming === 'true') {
    and.push({ appointmentDate: { [Op.gte]: new Date().toISOString().slice(0, 10) } });
    and.push({
      status: { [Op.in]: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
    });
  }
  if (and.length) where[Op.and] = and;

  const result = await Appointment.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['appointmentDate', req.query.sort === 'asc' ? 'ASC' : 'DESC'],
      ['appointmentTime', req.query.sort === 'asc' ? 'ASC' : 'DESC'],
    ],
    include: INCLUDES,
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const appointment = await loadScopedAppointment(req, req.params.id);
  res.json({ success: true, data: appointment });
});

const book = asyncHandler(async (req, res) => {
  let patientId = req.body.patientId;

  if (req.user.role === ROLES.PATIENT) {
    if (!req.patientProfile) throw ApiError.forbidden('No patient profile linked to this account');
    patientId = req.patientProfile.id; // patients can only book for themselves
  }
  if (!patientId) throw ApiError.badRequest('patientId is required');

  const appointment = await appointmentService.book({
    patientId,
    doctorId: req.body.doctorId,
    departmentId: req.body.departmentId,
    appointmentDate: req.body.appointmentDate,
    appointmentTime: req.body.appointmentTime,
    reason: req.body.reason,
    notes: req.body.notes,
    createdByUserId: req.user.id,
  });

  const created = await Appointment.findByPk(appointment.id, { include: INCLUDES });
  res.status(201).json({ success: true, message: 'Appointment booked', data: created });
});

const confirm = asyncHandler(async (req, res) => {
  const appointment = await loadScopedAppointment(req, req.params.id);
  await appointmentService.changeStatus(appointment, APPOINTMENT_STATUS.CONFIRMED, {
    notes: req.body.notes,
  });
  res.json({ success: true, message: 'Appointment confirmed', data: appointment });
});

const reject = asyncHandler(async (req, res) => {
  const appointment = await loadScopedAppointment(req, req.params.id);
  await appointmentService.changeStatus(appointment, APPOINTMENT_STATUS.REJECTED, {
    cancellationReason: req.body.reason || 'Rejected by doctor',
  });
  res.json({ success: true, message: 'Appointment rejected', data: appointment });
});

const complete = asyncHandler(async (req, res) => {
  const appointment = await loadScopedAppointment(req, req.params.id);
  await appointmentService.changeStatus(appointment, APPOINTMENT_STATUS.COMPLETED, {
    notes: req.body.notes,
  });
  res.json({ success: true, message: 'Appointment completed', data: appointment });
});

const cancel = asyncHandler(async (req, res) => {
  const appointment = await loadScopedAppointment(req, req.params.id);
  await appointmentService.changeStatus(appointment, APPOINTMENT_STATUS.CANCELLED, {
    cancellationReason: req.body.reason || `Cancelled by ${req.user.role.toLowerCase()}`,
  });
  res.json({ success: true, message: 'Appointment cancelled', data: appointment });
});

const reschedule = asyncHandler(async (req, res) => {
  const appointment = await loadScopedAppointment(req, req.params.id);
  await appointmentService.reschedule(appointment, {
    appointmentDate: req.body.appointmentDate,
    appointmentTime: req.body.appointmentTime,
  });
  const updated = await Appointment.findByPk(appointment.id, { include: INCLUDES });
  res.json({ success: true, message: 'Appointment rescheduled', data: updated });
});

const update = asyncHandler(async (req, res) => {
  const appointment = await loadScopedAppointment(req, req.params.id);
  if (req.body.reason !== undefined) appointment.reason = req.body.reason;
  if (req.body.notes !== undefined) appointment.notes = req.body.notes;
  await appointment.save();
  res.json({ success: true, message: 'Appointment updated', data: appointment });
});

module.exports = {
  list,
  getById,
  book,
  confirm,
  reject,
  complete,
  cancel,
  reschedule,
  update,
};
