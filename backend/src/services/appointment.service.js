'use strict';

const { Op } = require('sequelize');
const { Appointment, Doctor, Patient } = require('../models');
const { withTransaction } = require('../utils/transaction');
const {
  APPOINTMENT_STATUS,
  BLOCKING_APPOINTMENT_STATUSES,
} = require('../models/constants');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const config = require('../config');

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Allowed status transitions - anything else is rejected with a 400. */
const TRANSITIONS = {
  [APPOINTMENT_STATUS.PENDING]: [
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.REJECTED,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.CONFIRMED]: [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.COMPLETED]: [],
  [APPOINTMENT_STATUS.CANCELLED]: [],
  [APPOINTMENT_STATUS.REJECTED]: [],
};

function assertValidSlot(appointmentDate, appointmentTime) {
  if (!appointmentDate || Number.isNaN(Date.parse(appointmentDate))) {
    throw ApiError.badRequest('A valid appointmentDate (YYYY-MM-DD) is required');
  }
  if (!TIME_RE.test(appointmentTime || '')) {
    throw ApiError.badRequest('appointmentTime must be in HH:MM 24-hour format');
  }

  const slot = new Date(`${appointmentDate}T${appointmentTime}:00`);
  if (Number.isNaN(slot.getTime())) throw ApiError.badRequest('Invalid appointment date/time');

  // Allow a small grace window so "today, a minute ago" round-trips don't fail.
  if (slot.getTime() < Date.now() - 60 * 1000) {
    throw ApiError.badRequest('Appointments cannot be booked in the past');
  }
  return slot;
}

/**
 * Core double-booking guard. Runs inside the caller's transaction and locks the
 * doctor's matching rows so two concurrent requests cannot both pass the check.
 */
async function assertSlotIsFree({ doctorId, appointmentDate, appointmentTime, excludeId }, transaction) {
  const where = {
    doctorId,
    appointmentDate,
    appointmentTime,
    status: { [Op.in]: BLOCKING_APPOINTMENT_STATUSES },
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const lockOptions = { where, transaction };
  // SELECT ... FOR UPDATE is a MySQL/Postgres feature; SQLite (tests) serialises anyway.
  if (config.db.dialect !== 'sqlite') lockOptions.lock = transaction.LOCK.UPDATE;

  const clash = await Appointment.findOne(lockOptions);
  if (clash) {
    throw ApiError.conflict(
      `Dr. slot unavailable: this doctor already has an appointment on ${appointmentDate} at ${appointmentTime}`,
      [{ field: 'appointmentTime', message: 'Doctor is already booked for this date and time' }]
    );
  }
}

/** Stops a patient from holding two appointments in the same slot. */
async function assertPatientIsFree({ patientId, appointmentDate, appointmentTime, excludeId }, transaction) {
  const where = {
    patientId,
    appointmentDate,
    appointmentTime,
    status: { [Op.in]: BLOCKING_APPOINTMENT_STATUSES },
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const clash = await Appointment.findOne({ where, transaction });
  if (clash) {
    throw ApiError.conflict('This patient already has an appointment at that date and time');
  }
}

async function book(payload) {
  const { patientId, doctorId, appointmentDate, appointmentTime, reason } = payload;

  assertValidSlot(appointmentDate, appointmentTime);
  if (!reason || !String(reason).trim()) throw ApiError.badRequest('A reason is required');

  const [doctor, patient] = await Promise.all([
    Doctor.findByPk(doctorId),
    Patient.findByPk(patientId),
  ]);

  if (!doctor || !doctor.isActive) throw ApiError.notFound('Doctor not found');
  if (!doctor.isAvailable) throw ApiError.badRequest('This doctor is not accepting appointments');
  if (!patient || !patient.isActive) throw ApiError.notFound('Patient not found');

  return withTransaction(async (transaction) => {
    await assertSlotIsFree({ doctorId, appointmentDate, appointmentTime }, transaction);
    await assertPatientIsFree({ patientId, appointmentDate, appointmentTime }, transaction);

    const appointmentCode = await generateCode(Appointment, 'APT', { transaction });

    return Appointment.create(
      {
        appointmentCode,
        patientId,
        doctorId,
        departmentId: payload.departmentId || doctor.departmentId,
        appointmentDate,
        appointmentTime,
        reason: String(reason).trim(),
        status: APPOINTMENT_STATUS.PENDING,
        notes: payload.notes || null,
        createdByUserId: payload.createdByUserId || null,
      },
      { transaction }
    );
  });
}

async function reschedule(appointment, { appointmentDate, appointmentTime }) {
  const finalStatuses = [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.REJECTED,
  ];
  if (finalStatuses.includes(appointment.status)) {
    throw ApiError.badRequest(`A ${appointment.status.toLowerCase()} appointment cannot be rescheduled`);
  }

  const date = appointmentDate || appointment.appointmentDate;
  const time = appointmentTime || appointment.appointmentTime;
  assertValidSlot(date, time);

  return withTransaction(async (transaction) => {
    await assertSlotIsFree(
      {
        doctorId: appointment.doctorId,
        appointmentDate: date,
        appointmentTime: time,
        excludeId: appointment.id,
      },
      transaction
    );

    appointment.appointmentDate = date;
    appointment.appointmentTime = time;
    appointment.status = APPOINTMENT_STATUS.PENDING;
    await appointment.save({ transaction });
    return appointment;
  });
}

async function changeStatus(appointment, nextStatus, extra = {}) {
  const allowed = TRANSITIONS[appointment.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.badRequest(
      `Cannot change an appointment from "${appointment.status}" to "${nextStatus}"`
    );
  }

  appointment.status = nextStatus;
  if (extra.notes !== undefined) appointment.notes = extra.notes;
  if (extra.cancellationReason !== undefined) {
    appointment.cancellationReason = extra.cancellationReason;
  }
  await appointment.save();
  return appointment;
}

/** Free slots for a doctor on a given date, based on their availability map. */
async function availableSlots(doctorId, date) {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw ApiError.notFound('Doctor not found');
  if (!date || Number.isNaN(Date.parse(date))) throw ApiError.badRequest('A valid date is required');

  const weekday = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const availability = doctor.availability || {};
  const configured = Array.isArray(availability[weekday]) ? availability[weekday] : [];

  const taken = await Appointment.findAll({
    where: {
      doctorId,
      appointmentDate: date,
      status: { [Op.in]: BLOCKING_APPOINTMENT_STATUSES },
    },
    attributes: ['appointmentTime'],
  });
  const takenSet = new Set(taken.map((a) => a.appointmentTime));

  return {
    date,
    weekday,
    slots: configured.map((time) => ({ time, available: !takenSet.has(time) })),
  };
}

module.exports = {
  book,
  reschedule,
  changeStatus,
  availableSlots,
  assertSlotIsFree,
  assertValidSlot,
  TRANSITIONS,
};
