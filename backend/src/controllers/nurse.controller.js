'use strict';

const { Op } = require('sequelize');
const { Nurse, User, Department, MedicalRecord } = require('../models');
const { withTransaction } = require('../utils/transaction');
const { ROLES } = require('../models/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');
const { getPagination, paginatedResponse } = require('../utils/pagination');

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = {};
  const and = [];

  if (req.query.search) {
    const term = `%${req.query.search}%`;
    and.push({
      [Op.or]: [
        { fullName: { [Op.like]: term } },
        { nurseCode: { [Op.like]: term } },
        { email: { [Op.like]: term } },
      ],
    });
  }
  if (req.query.departmentId) and.push({ departmentId: req.query.departmentId });
  if (req.query.shift) and.push({ shift: req.query.shift });
  if (req.query.isActive !== undefined) and.push({ isActive: req.query.isActive === 'true' });
  if (and.length) where[Op.and] = and;

  const result = await Nurse.findAndCountAll({
    where,
    limit,
    offset,
    order: [['fullName', 'ASC']],
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const nurse = await Nurse.findByPk(req.params.id, {
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
  });
  if (!nurse) throw ApiError.notFound('Nurse not found');
  res.json({ success: true, data: nurse });
});

const create = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    throw ApiError.badRequest('fullName, email and password are required');
  }

  if (req.body.departmentId) {
    const department = await Department.findByPk(req.body.departmentId);
    if (!department) throw ApiError.badRequest('Department not found');
  }

  const normalisedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalisedEmail } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const nurse = await withTransaction(async (transaction) => {
    const user = await User.create(
      {
        fullName,
        email: normalisedEmail,
        password,
        phone: req.body.phone || null,
        role: ROLES.NURSE,
      },
      { transaction }
    );

    const nurseCode = await generateCode(Nurse, 'NUR', { transaction });
    return Nurse.create(
      {
        nurseCode,
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
  });

  res.status(201).json({ success: true, message: 'Nurse created', data: nurse });
});

const update = asyncHandler(async (req, res) => {
  const nurse = await Nurse.findByPk(req.params.id);
  if (!nurse) throw ApiError.notFound('Nurse not found');

  const isSelf = req.nurseProfile && req.nurseProfile.id === nurse.id;
  if (req.user.role !== ROLES.ADMIN && !isSelf) {
    throw ApiError.forbidden('You can only update your own profile');
  }

  const adminFields = ['departmentId', 'shift', 'isActive'];
  const selfFields = ['fullName', 'phone', 'experienceYears'];
  const allowed = req.user.role === ROLES.ADMIN ? [...adminFields, ...selfFields] : selfFields;

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) nurse[field] = req.body[field];
  });

  await nurse.save();
  res.json({ success: true, message: 'Nurse updated', data: nurse });
});

const remove = asyncHandler(async (req, res) => {
  const nurse = await Nurse.findByPk(req.params.id);
  if (!nurse) throw ApiError.notFound('Nurse not found');

  const records = await MedicalRecord.count({ where: { nurseId: nurse.id } });
  if (records > 0) {
    nurse.isActive = false;
    await nurse.save();
    await User.update({ isActive: false }, { where: { id: nurse.userId } });
    return res.json({
      success: true,
      message: 'Nurse has recorded notes and was deactivated instead of deleted',
      data: nurse,
    });
  }

  const userId = nurse.userId;
  await nurse.destroy();
  await User.destroy({ where: { id: userId } });
  return res.json({ success: true, message: 'Nurse deleted' });
});

module.exports = { list, getById, create, update, remove };
