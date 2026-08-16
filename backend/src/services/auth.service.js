'use strict';

const { User, Patient, Doctor, Nurse } = require('../models');
const { withTransaction } = require('../utils/transaction');
const { ROLES } = require('../models/constants');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/token');

/** Loads the role-specific profile row for a user, if any. */
async function loadProfile(user, options = {}) {
  switch (user.role) {
    case ROLES.PATIENT:
      return Patient.findOne({ where: { userId: user.id }, ...options });
    case ROLES.DOCTOR:
      return Doctor.findOne({ where: { userId: user.id }, ...options });
    case ROLES.NURSE:
      return Nurse.findOne({ where: { userId: user.id }, ...options });
    default:
      return null;
  }
}

function buildAuthPayload(user, profile) {
  return {
    token: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
    },
    profile: profile ? profile.toJSON() : null,
  };
}

/**
 * Public self-registration. Only ever creates a Patient account - staff
 * accounts are created by an Admin through /api/users.
 */
async function register(payload) {
  const email = String(payload.email || '').trim().toLowerCase();

  const existing = await User.findOne({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  return withTransaction(async (transaction) => {
    const user = await User.create(
      {
        fullName: payload.fullName,
        email,
        password: payload.password,
        phone: payload.phone || null,
        role: ROLES.PATIENT,
      },
      { transaction }
    );

    const patientCode = await generateCode(Patient, 'PAT', { transaction });
    const patient = await Patient.create(
      {
        patientCode,
        userId: user.id,
        fullName: payload.fullName,
        phone: payload.phone || 'N/A',
        email,
        dateOfBirth: payload.dateOfBirth || null,
        gender: payload.gender || null,
        address: payload.address || null,
        bloodGroup: payload.bloodGroup || 'Unknown',
        emergencyContactName: payload.emergencyContactName || null,
        emergencyContactPhone: payload.emergencyContactPhone || null,
        medicalHistory: payload.medicalHistory || null,
        allergies: payload.allergies || null,
      },
      { transaction }
    );

    return buildAuthPayload(user, patient);
  });
}

async function login(email, password) {
  const normalised = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalised } });

  // Same message for unknown email and wrong password - no account enumeration.
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const matches = await user.comparePassword(password);
  if (!matches) throw ApiError.unauthorized('Invalid email or password');

  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save({ fields: ['lastLoginAt'] });

  const profile = await loadProfile(user);
  return buildAuthPayload(user, profile);
}

async function refresh(refreshToken) {
  if (!refreshToken) throw ApiError.badRequest('Refresh token is required');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findByPk(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account is unavailable');

  const profile = await loadProfile(user);
  return buildAuthPayload(user, profile);
}

async function changePassword(user, currentPassword, newPassword) {
  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  user.password = newPassword;
  await user.save();
  return true;
}

async function me(user) {
  const profile = await loadProfile(user);
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    },
    profile: profile ? profile.toJSON() : null,
  };
}

module.exports = { register, login, refresh, changePassword, me, loadProfile, buildAuthPayload };
