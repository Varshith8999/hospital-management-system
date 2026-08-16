'use strict';

const ROLES = Object.freeze({
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PATIENT: 'Patient',
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

const APPOINTMENT_STATUS = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
});

const APPOINTMENT_STATUS_VALUES = Object.freeze(Object.values(APPOINTMENT_STATUS));

// Statuses that still occupy a doctor's slot.
const BLOCKING_APPOINTMENT_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.COMPLETED,
]);

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
});

const PAYMENT_STATUS_VALUES = Object.freeze(Object.values(PAYMENT_STATUS));

const GENDERS = Object.freeze(['Male', 'Female', 'Other']);

const BLOOD_GROUPS = Object.freeze(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']);

const RECORD_TYPES = Object.freeze(['Consultation', 'Vitals', 'Nursing Note']);

const SHIFTS = Object.freeze(['Morning', 'Evening', 'Night', 'Rotational']);

const WEEKDAYS = Object.freeze([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

module.exports = {
  ROLES,
  ROLE_VALUES,
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_VALUES,
  BLOCKING_APPOINTMENT_STATUSES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  GENDERS,
  BLOOD_GROUPS,
  RECORD_TYPES,
  SHIFTS,
  WEEKDAYS,
};
