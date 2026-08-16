'use strict';

const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  Department,
  Doctor,
  Nurse,
  Patient,
} = require('../src/models');
const { ROLES } = require('../src/models/constants');

const PASSWORD = 'Password@123';

/** Truncates every table between tests so cases stay independent. */
async function resetDb() {
  await sequelize.sync({ force: true });
}

async function createDepartment(overrides = {}) {
  return Department.create({
    name: overrides.name || `Cardiology-${Math.random().toString(36).slice(2, 7)}`,
    description: 'Test department',
    ...overrides,
  });
}

async function createUser(role, overrides = {}) {
  return User.create({
    fullName: overrides.fullName || `${role} User`,
    email: overrides.email || `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`,
    password: overrides.password || PASSWORD,
    role,
    phone: overrides.phone || '+91-9800000000',
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
  });
}

async function createAdmin(overrides = {}) {
  return createUser(ROLES.ADMIN, overrides);
}

async function createReceptionist(overrides = {}) {
  return createUser(ROLES.RECEPTIONIST, overrides);
}

async function createDoctor(department, overrides = {}) {
  const dept = department || (await createDepartment());
  const user = await createUser(ROLES.DOCTOR, overrides);
  const doctor = await Doctor.create({
    doctorCode: `DOC-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    specialization: overrides.specialization || 'Cardiology',
    departmentId: dept.id,
    experienceYears: 8,
    consultationFee: 500,
    availability: { Monday: ['09:00', '09:30'], Tuesday: ['09:00'] },
  });
  return { user, doctor, department: dept };
}

async function createNurse(department, overrides = {}) {
  const dept = department || (await createDepartment());
  const user = await createUser(ROLES.NURSE, overrides);
  const nurse = await Nurse.create({
    nurseCode: `NUR-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    departmentId: dept.id,
    shift: 'Morning',
  });
  return { user, nurse, department: dept };
}

async function createPatient(overrides = {}) {
  const user = overrides.withLogin === false ? null : await createUser(ROLES.PATIENT, overrides);
  const patient = await Patient.create({
    patientCode: `PAT-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
    userId: user ? user.id : null,
    fullName: overrides.fullName || (user ? user.fullName : 'Walk-in Patient'),
    phone: overrides.phone || '+91-9811111111',
    email: user ? user.email : null,
    gender: overrides.gender || 'Male',
    bloodGroup: overrides.bloodGroup || 'O+',
    dateOfBirth: overrides.dateOfBirth || '1990-01-01',
  });
  return { user, patient };
}

/** Logs in through the real /api/auth/login endpoint and returns the JWT. */
async function login(email, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Returns a YYYY-MM-DD date N days from today. */
function futureDate(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  app,
  request,
  PASSWORD,
  resetDb,
  createDepartment,
  createUser,
  createAdmin,
  createReceptionist,
  createDoctor,
  createNurse,
  createPatient,
  login,
  auth,
  futureDate,
};
