'use strict';

const { ROLES } = require('../models/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const dashboardService = require('../services/dashboard.service');

/**
 * GET /api/dashboard
 * Returns the statistics block matching the caller's role. There is one
 * endpoint so the frontend never has to guess which URL its role should hit.
 */
const summary = asyncHandler(async (req, res) => {
  let data;

  switch (req.user.role) {
    case ROLES.ADMIN:
      data = await dashboardService.adminStats();
      break;
    case ROLES.DOCTOR:
      if (!req.doctorProfile) throw ApiError.forbidden('No doctor profile linked to this account');
      data = await dashboardService.doctorStats(req.doctorProfile.id);
      break;
    case ROLES.NURSE:
      if (!req.nurseProfile) throw ApiError.forbidden('No nurse profile linked to this account');
      data = await dashboardService.nurseStats(req.nurseProfile);
      break;
    case ROLES.RECEPTIONIST:
      data = await dashboardService.receptionistStats();
      break;
    case ROLES.PATIENT:
      if (!req.patientProfile) throw ApiError.forbidden('No patient profile linked to this account');
      data = await dashboardService.patientStats(req.patientProfile.id);
      break;
    default:
      throw ApiError.forbidden();
  }

  res.json({ success: true, role: req.user.role, data });
});

module.exports = { summary };
