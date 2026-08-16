'use strict';

const { Op } = require('sequelize');
const { User, Patient, Doctor, Nurse, Department } = require('../models');
const { withTransaction } = require('../utils/transaction');
const { ROLES, ROLE_VALUES } = require('../models/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const { getPagination, paginatedResponse } = require('../utils/pagination');

const SAFE_ATTRIBUTES = ['id', 'fullName', 'email', 'role', 'phone', 'isActive', 'lastLoginAt', 'createdAt'];

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = {};
  const and = [];

  if (req.query.search) {
    const term = `%${req.query.search}%`;
    and.push({ [Op.or]: [{ fullName: { [Op.like]: term } }, { email: { [Op.like]: term } }] });
  }
  if (req.query.role) and.push({ role: req.query.role });
  if (req.query.isActive !== undefined) and.push({ isActive: req.query.isActive === 'true' });
  if (and.length) where[Op.and] = and;

  const result = await User.findAndCountAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    attributes: SAFE_ATTRIBUTES,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, { attributes: SAFE_ATTRIBUTES });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: user });
});

/**
 * Admin-only user creation. Creating a Doctor / Nurse / Patient also creates
 * the matching profile row so the account is immediately usable.
 */
const create = asyncHandler(async (req, res) => {
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    throw ApiError.badRequest('fullName, email, password and role are required');
  }
  if (!ROLE_VALUES.includes(role)) {
    throw ApiError.badRequest(`role must be one of: ${ROLE_VALUES.join(', ')}`);
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long');
  }

  const normalisedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalisedEmail } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  if (role === ROLES.DOCTOR) {
    if (!req.body.specialization || !req.body.departmentId) {
      throw ApiError.badRequest('Doctors require specialization and departmentId');
    }
    const department = await Department.findByPk(req.body.departmentId);
    if (!department) throw ApiError.badRequest('Department not found');
  }

  const result = await withTransaction(async (transaction) => {
    const user = await User.create(
      { fullName, email: normalisedEmail, password, phone: req.body.phone || null, role },
      { transaction }
    );

    let profile = null;
    if (role === ROLES.DOCTOR) {
      profile = await Doctor.create(
        {
          doctorCode: await generateCode(Doctor, 'DOC', { transaction }),
          userId: user.id,
          fullName,
          email: normalisedEmail,
          phone: req.body.phone || null,
          specialization: req.body.specialization,
          departmentId: req.body.departmentId,
          experienceYears: req.body.experienceYears || 0,
          qualification: req.body.qualification || null,
          consultationFee: req.body.consultationFee || 0,
          availability: req.body.availability || null,
        },
        { transaction }
      );
    } else if (role === ROLES.NURSE) {
      profile = await Nurse.create(
        {
          nurseCode: await generateCode(Nurse, 'NUR', { transaction }),
          userId: user.id,
          fullName,
          email: normalisedEmail,
          phone: req.body.phone || null,
          departmentId: req.body.departmentId || null,
          shift: req.body.shift || 'Morning',
          experienceYears: req.body.experienceYears || 0,
        },
        { transaction }
      );
    } else if (role === ROLES.PATIENT) {
      profile = await Patient.create(
        {
          patientCode: await generateCode(Patient, 'PAT', { transaction }),
          userId: user.id,
          fullName,
          phone: req.body.phone || 'N/A',
          email: normalisedEmail,
          dateOfBirth: req.body.dateOfBirth || null,
          gender: req.body.gender || null,
          bloodGroup: req.body.bloodGroup || 'Unknown',
        },
        { transaction }
      );
    }

    return { user, profile };
  });

  res.status(201).json({
    success: true,
    message: `${role} account created`,
    data: { user: result.user, profile: result.profile },
  });
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  ['fullName', 'phone', 'isActive'].forEach((field) => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });

  if (req.body.role !== undefined && req.body.role !== user.role) {
    throw ApiError.badRequest(
      'Changing a role would orphan the linked profile. Deactivate this account and create a new one instead.'
    );
  }

  if (req.body.password) {
    if (String(req.body.password).length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters long');
    }
    user.password = req.body.password;
  }

  await user.save();
  res.json({ success: true, message: 'User updated', data: user });
});

/** Deactivates rather than deletes so historical records keep their author. */
const setActive = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.id === req.user.id) throw ApiError.badRequest('You cannot deactivate your own account');

  user.isActive = req.body.isActive !== false;
  await user.save();

  const flag = { isActive: user.isActive };
  if (user.role === ROLES.DOCTOR) await Doctor.update(flag, { where: { userId: user.id } });
  if (user.role === ROLES.NURSE) await Nurse.update(flag, { where: { userId: user.id } });
  if (user.role === ROLES.PATIENT) await Patient.update(flag, { where: { userId: user.id } });

  res.json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
    data: user,
  });
});

const remove = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');
  if (user.role === ROLES.ADMIN) {
    const admins = await User.count({ where: { role: ROLES.ADMIN, isActive: true } });
    if (admins <= 1) throw ApiError.badRequest('Cannot delete the last active administrator');
  }

  await user.destroy();
  res.json({ success: true, message: 'User deleted' });
});

module.exports = { list, getById, create, update, setActive, remove };
