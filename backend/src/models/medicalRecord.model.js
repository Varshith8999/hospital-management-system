'use strict';

const { DataTypes, Model } = require('sequelize');
const { RECORD_TYPES } = require('./constants');

module.exports = (sequelize) => {
  class MedicalRecord extends Model {}

  MedicalRecord.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      recordCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      patientId: { type: DataTypes.INTEGER, allowNull: false },
      doctorId: { type: DataTypes.INTEGER, allowNull: true },
      nurseId: { type: DataTypes.INTEGER, allowNull: true },
      appointmentId: { type: DataTypes.INTEGER, allowNull: true },
      recordType: {
        type: DataTypes.ENUM(...RECORD_TYPES),
        allowNull: false,
        defaultValue: 'Consultation',
      },
      diagnosis: { type: DataTypes.TEXT, allowNull: true },
      symptoms: { type: DataTypes.TEXT, allowNull: true },
      treatment: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      // Vitals - recorded by nurses (or doctors) during a visit.
      bloodPressure: { type: DataTypes.STRING(20), allowNull: true },
      temperature: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      pulse: { type: DataTypes.INTEGER, allowNull: true },
      respirationRate: { type: DataTypes.INTEGER, allowNull: true },
      oxygenSaturation: { type: DataTypes.INTEGER, allowNull: true },
      weightKg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      heightCm: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      recordDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'MedicalRecord',
      tableName: 'MedicalRecords',
      indexes: [
        { unique: true, fields: ['recordCode'] },
        { fields: ['patientId'] },
        { fields: ['doctorId'] },
        { fields: ['recordDate'] },
      ],
    }
  );

  MedicalRecord.associate = (models) => {
    MedicalRecord.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    MedicalRecord.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
    MedicalRecord.belongsTo(models.Nurse, { foreignKey: 'nurseId', as: 'nurse' });
    MedicalRecord.belongsTo(models.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
  };

  return MedicalRecord;
};
