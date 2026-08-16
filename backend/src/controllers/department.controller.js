'use strict';

const { Op } = require('sequelize');
const { Department, Doctor } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination, paginatedResponse } = require('../utils/pagination');

const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = {};

  if (req.query.search) {
    where.name = { [Op.like]: `%${req.query.search}%` };
  }
  if (req.query.isActive !== undefined) {
    where.isActive = req.query.isActive === 'true';
  }

  const result = await Department.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    include: [
      {
        model: Doctor,
        as: 'doctors',
        attributes: ['id', 'fullName', 'specialization', 'isAvailable'],
        required: false,
      },
    ],
    distinct: true,
  });

  res.json({ success: true, ...paginatedResponse(result, { page, limit }) });
});

const getById = asyncHandler(async (req, res) => {
  const department = await Department.findByPk(req.params.id, {
    include: [
      {
        model: Doctor,
        as: 'doctors',
        attributes: ['id', 'doctorCode', 'fullName', 'specialization', 'experienceYears', 'isAvailable'],
      },
    ],
  });
  if (!department) throw ApiError.notFound('Department not found');
  res.json({ success: true, data: department });
});

const create = asyncHandler(async (req, res) => {
  const { name, description, location, phone } = req.body;

  const existing = await Department.findOne({ where: { name } });
  if (existing) throw ApiError.conflict('A department with this name already exists');

  const department = await Department.create({ name, description, location, phone });
  res.status(201).json({ success: true, message: 'Department created', data: department });
});

const update = asyncHandler(async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');

  const fields = ['name', 'description', 'location', 'phone', 'isActive'];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) department[field] = req.body[field];
  });

  await department.save();
  res.json({ success: true, message: 'Department updated', data: department });
});

const remove = asyncHandler(async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');

  const doctorCount = await Doctor.count({ where: { departmentId: department.id } });
  if (doctorCount > 0) {
    throw ApiError.conflict(
      `Cannot delete: ${doctorCount} doctor(s) still belong to this department. Reassign them first.`
    );
  }

  await department.destroy();
  res.json({ success: true, message: 'Department deleted' });
});

module.exports = { list, getById, create, update, remove };
