export const ROLES = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PATIENT: 'Patient',
};

export const ROLE_HOME = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.DOCTOR]: '/doctor',
  [ROLES.NURSE]: '/nurse',
  [ROLES.RECEPTIONIST]: '/receptionist',
  [ROLES.PATIENT]: '/patient',
};

export const APPOINTMENT_STATUSES = [
  'Pending',
  'Confirmed',
  'Completed',
  'Cancelled',
  'Rejected',
];

export const PAYMENT_STATUSES = ['Pending', 'Partially Paid', 'Paid'];

export const GENDERS = ['Male', 'Female', 'Other'];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export const SHIFTS = ['Morning', 'Evening', 'Night', 'Rotational'];

export const RECORD_TYPES = ['Consultation', 'Vitals', 'Nursing Note'];

export const STATUS_TONE = {
  Pending: 'amber',
  Confirmed: 'blue',
  Completed: 'emerald',
  Cancelled: 'slate',
  Rejected: 'rose',
  Paid: 'emerald',
  'Partially Paid': 'amber',
};
