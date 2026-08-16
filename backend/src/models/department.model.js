'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Department extends Model {}

  Department.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true, len: [2, 100] },
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      location: { type: DataTypes.STRING(120), allowNull: true },
      phone: { type: DataTypes.STRING(20), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Department',
      tableName: 'Departments',
      indexes: [{ unique: true, fields: ['name'] }],
    }
  );

  Department.associate = (models) => {
    Department.hasMany(models.Doctor, { foreignKey: 'departmentId', as: 'doctors' });
    Department.hasMany(models.Nurse, { foreignKey: 'departmentId', as: 'nurses' });
    Department.hasMany(models.Appointment, { foreignKey: 'departmentId', as: 'appointments' });
  };

  return Department;
};
