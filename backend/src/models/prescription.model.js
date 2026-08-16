'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Prescription extends Model {}

  Prescription.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      prescriptionCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      patientId: { type: DataTypes.INTEGER, allowNull: false },
      doctorId: { type: DataTypes.INTEGER, allowNull: false },
      appointmentId: { type: DataTypes.INTEGER, allowNull: true },
      medicalRecordId: { type: DataTypes.INTEGER, allowNull: true },
      medicine: {
        type: DataTypes.STRING(160),
        allowNull: false,
        validate: { notEmpty: true },
      },
      dosage: { type: DataTypes.STRING(80), allowNull: false, validate: { notEmpty: true } },
      frequency: { type: DataTypes.STRING(80), allowNull: false, validate: { notEmpty: true } },
      duration: { type: DataTypes.STRING(80), allowNull: false, validate: { notEmpty: true } },
      instructions: { type: DataTypes.TEXT, allowNull: true },
      prescriptionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Prescription',
      tableName: 'Prescriptions',
      indexes: [
        { unique: true, fields: ['prescriptionCode'] },
        { fields: ['patientId'] },
        { fields: ['doctorId'] },
        { fields: ['prescriptionDate'] },
      ],
    }
  );

  Prescription.associate = (models) => {
    Prescription.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    Prescription.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
    Prescription.belongsTo(models.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
    Prescription.belongsTo(models.MedicalRecord, {
      foreignKey: 'medicalRecordId',
      as: 'medicalRecord',
    });
  };

  return Prescription;
};
