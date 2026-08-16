'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Doctor extends Model {}

  Doctor.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      doctorCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      fullName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true },
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        validate: { isEmail: true },
      },
      phone: { type: DataTypes.STRING(20), allowNull: true },
      specialization: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true },
      },
      departmentId: { type: DataTypes.INTEGER, allowNull: false },
      experienceYears: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0, max: 70 },
      },
      qualification: { type: DataTypes.STRING(160), allowNull: true },
      consultationFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        get() {
          const raw = this.getDataValue('consultationFee');
          return raw === null ? null : parseFloat(raw);
        },
      },
      // Weekly availability, e.g. { "Monday": ["09:00", "09:30"], ... }
      availability: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
      },
      isAvailable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Doctor',
      tableName: 'Doctors',
      indexes: [
        { unique: true, fields: ['doctorCode'] },
        { fields: ['departmentId'] },
        { fields: ['specialization'] },
      ],
    }
  );

  Doctor.associate = (models) => {
    Doctor.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Doctor.belongsTo(models.Department, { foreignKey: 'departmentId', as: 'department' });
    Doctor.hasMany(models.Appointment, { foreignKey: 'doctorId', as: 'appointments' });
    Doctor.hasMany(models.MedicalRecord, { foreignKey: 'doctorId', as: 'medicalRecords' });
    Doctor.hasMany(models.Prescription, { foreignKey: 'doctorId', as: 'prescriptions' });
  };

  return Doctor;
};
