'use strict';

const { DataTypes, Model } = require('sequelize');
const { SHIFTS } = require('./constants');

module.exports = (sequelize) => {
  class Nurse extends Model {}

  Nurse.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      nurseCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      fullName: { type: DataTypes.STRING(120), allowNull: false, validate: { notEmpty: true } },
      email: { type: DataTypes.STRING(160), allowNull: false, validate: { isEmail: true } },
      phone: { type: DataTypes.STRING(20), allowNull: true },
      departmentId: { type: DataTypes.INTEGER, allowNull: true },
      shift: {
        type: DataTypes.ENUM(...SHIFTS),
        allowNull: false,
        defaultValue: 'Morning',
      },
      experienceYears: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0, max: 70 },
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Nurse',
      tableName: 'Nurses',
      indexes: [{ unique: true, fields: ['nurseCode'] }, { fields: ['departmentId'] }],
    }
  );

  Nurse.associate = (models) => {
    Nurse.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Nurse.belongsTo(models.Department, { foreignKey: 'departmentId', as: 'department' });
    Nurse.hasMany(models.MedicalRecord, { foreignKey: 'nurseId', as: 'medicalRecords' });
  };

  return Nurse;
};
