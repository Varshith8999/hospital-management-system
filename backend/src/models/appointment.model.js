'use strict';

const { DataTypes, Model } = require('sequelize');
const { APPOINTMENT_STATUS_VALUES, APPOINTMENT_STATUS } = require('./constants');

module.exports = (sequelize) => {
  class Appointment extends Model {}

  Appointment.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      appointmentCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      patientId: { type: DataTypes.INTEGER, allowNull: false },
      doctorId: { type: DataTypes.INTEGER, allowNull: false },
      departmentId: { type: DataTypes.INTEGER, allowNull: false },
      appointmentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: { isDate: true },
      },
      // Stored as HH:MM (24h) so date/time comparisons stay portable.
      appointmentTime: {
        type: DataTypes.STRING(5),
        allowNull: false,
        validate: {
          is: {
            args: /^([01]\d|2[0-3]):([0-5]\d)$/,
            msg: 'appointmentTime must be in HH:MM 24-hour format',
          },
        },
      },
      reason: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
      status: {
        type: DataTypes.ENUM(...APPOINTMENT_STATUS_VALUES),
        allowNull: false,
        defaultValue: APPOINTMENT_STATUS.PENDING,
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      cancellationReason: { type: DataTypes.TEXT, allowNull: true },
      createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Appointment',
      tableName: 'Appointments',
      indexes: [
        { unique: true, fields: ['appointmentCode'] },
        { fields: ['doctorId', 'appointmentDate', 'appointmentTime'], name: 'idx_doctor_slot' },
        { fields: ['patientId', 'appointmentDate'] },
        { fields: ['status'] },
      ],
    }
  );

  Appointment.associate = (models) => {
    Appointment.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    Appointment.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
    Appointment.belongsTo(models.Department, { foreignKey: 'departmentId', as: 'department' });
    Appointment.hasMany(models.MedicalRecord, { foreignKey: 'appointmentId', as: 'medicalRecords' });
    Appointment.hasMany(models.Prescription, { foreignKey: 'appointmentId', as: 'prescriptions' });
    Appointment.hasOne(models.Bill, { foreignKey: 'appointmentId', as: 'bill' });
  };

  return Appointment;
};
