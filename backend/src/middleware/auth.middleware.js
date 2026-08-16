'use strict';

const { User, Patient, Doctor, Nurse } = require('../models');
const { verifyAccessToken } = require('../utils/token');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../models/constants');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Verifies the JWT, loads the user (and their role profile) and attaches them
 * to the request. Rejects disabled accounts and stale tokens.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Missing authentication token');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Session expired, please log in again');
    }
    throw ApiError.unauthorized('Invalid authentication token');
  }

  const user = await User.findByPk(payload.sub, {
    include: [
      { model: Patient, as: 'patientProfile', required: false },
      { model: Doctor, as: 'doctorProfile', required: false },
      { model: Nurse, as: 'nurseProfile', required: false },
    ],
  });

  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Account has been deactivated');

  req.user = user;
  req.patientProfile = user.patientProfile || null;
  req.doctorProfile = user.doctorProfile || null;
  req.nurseProfile = user.nurseProfile || null;
  return next();
});

/** Restricts a route to one or more roles. Must run after `authenticate`. */
function authorize(...roles) {
  const allowed = roles.flat();
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (allowed.length && !allowed.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role "${req.user.role}" is not allowed to access this resource`
        )
      );
    }
    return next();
  };
}

/** Ensures the authenticated user actually has the profile row their role needs. */
function requireProfile(role) {
  const key = {
    [ROLES.DOCTOR]: 'doctorProfile',
    [ROLES.NURSE]: 'nurseProfile',
    [ROLES.PATIENT]: 'patientProfile',
  }[role];

  return (req, _res, next) => {
    if (!req[key]) {
      return next(ApiError.forbidden(`No ${role.toLowerCase()} profile linked to this account`));
    }
    return next();
  };
}

module.exports = { authenticate, authorize, requireProfile, extractToken };
