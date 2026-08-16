'use strict';

const { Op, literal } = require('sequelize');
const { Patient, Appointment } = require('../models');
const { ROLES } = require('../models/constants');
const ApiError = require('../utils/ApiError');

const int = (value) => {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n)) throw ApiError.badRequest('Invalid identifier');
  return n;
};

/**
 * Returns a Sequelize `where` fragment (keyed on Patient.id) restricting the
 * caller to the patients they are allowed to see.
 *  - Admin / Receptionist : everyone
 *  - Doctor               : patients who have an appointment with them
 *  - Nurse                : patients with an appointment in their department
 *  - Patient              : themselves only
 */
function patientScope(req) {
  switch (req.user.role) {
    case ROLES.ADMIN:
    case ROLES.RECEPTIONIST:
      return {};

    case ROLES.DOCTOR: {
      if (!req.doctorProfile) throw ApiError.forbidden('No doctor profile linked to this account');
      const id = int(req.doctorProfile.id);
      return {
        id: {
          [Op.in]: literal(`(SELECT patientId FROM Appointments WHERE doctorId = ${id})`),
        },
      };
    }

    case ROLES.NURSE: {
      if (!req.nurseProfile) throw ApiError.forbidden('No nurse profile linked to this account');
      if (!req.nurseProfile.departmentId) return {};
      const deptId = int(req.nurseProfile.departmentId);
      return {
        id: {
          [Op.in]: literal(`(SELECT patientId FROM Appointments WHERE departmentId = ${deptId})`),
        },
      };
    }

    case ROLES.PATIENT: {
      if (!req.patientProfile) throw ApiError.forbidden('No patient profile linked to this account');
      return { id: int(req.patientProfile.id) };
    }

    default:
      throw ApiError.forbidden();
  }
}

/** Loads a patient, enforcing the caller's scope. Throws 404/403 as appropriate. */
async function getAccessiblePatient(req, patientId, options = {}) {
  const id = int(patientId);
  const patient = await Patient.findByPk(id, options);
  if (!patient) throw ApiError.notFound('Patient not found');

  const role = req.user.role;
  if (role === ROLES.ADMIN || role === ROLES.RECEPTIONIST) return patient;

  if (role === ROLES.PATIENT) {
    if (!req.patientProfile || req.patientProfile.id !== patient.id) {
      throw ApiError.forbidden('You can only access your own patient record');
    }
    return patient;
  }

  if (role === ROLES.DOCTOR) {
    const linked = await Appointment.count({
      where: { doctorId: req.doctorProfile.id, patientId: patient.id },
    });
    if (!linked) throw ApiError.forbidden('This patient is not assigned to you');
    return patient;
  }

  if (role === ROLES.NURSE) {
    if (!req.nurseProfile.departmentId) return patient;
    const linked = await Appointment.count({
      where: { departmentId: req.nurseProfile.departmentId, patientId: patient.id },
    });
    if (!linked) throw ApiError.forbidden('This patient is not in your department');
    return patient;
  }

  throw ApiError.forbidden();
}

/** Scope fragment keyed on a `patientId` column (records, prescriptions, bills). */
function ownRecordsScope(req, column = 'patientId') {
  const role = req.user.role;
  if (role === ROLES.PATIENT) {
    if (!req.patientProfile) throw ApiError.forbidden('No patient profile linked to this account');
    return { [column]: req.patientProfile.id };
  }
  if (role === ROLES.DOCTOR) {
    const id = int(req.doctorProfile.id);
    return {
      [column]: {
        [Op.in]: literal(`(SELECT patientId FROM Appointments WHERE doctorId = ${id})`),
      },
    };
  }
  return {};
}

module.exports = { patientScope, getAccessiblePatient, ownRecordsScope };
