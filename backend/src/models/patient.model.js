'use strict';

const { DataTypes, Model } = require('sequelize');
const { GENDERS, BLOOD_GROUPS } = require('./constants');

module.exports = (sequelize) => {
  class Patient extends Model {
    get age() {
      if (!this.dateOfBirth) return null;
      const dob = new Date(this.dateOfBirth);
      const diff = Date.now() - dob.getTime();
      return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }
  }

  Patient.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      patientCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
      },
      fullName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true, len: [2, 120] },
      },
      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true },
      gender: { type: DataTypes.ENUM(...GENDERS), allowNull: true },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { notEmpty: true },
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: true,
        validate: { isEmail: true },
      },
      address: { type: DataTypes.TEXT, allowNull: true },
      bloodGroup: {
        type: DataTypes.ENUM(...BLOOD_GROUPS),
        allowNull: false,
        defaultValue: 'Unknown',
      },
      emergencyContactName: { type: DataTypes.STRING(120), allowNull: true },
      emergencyContactPhone: { type: DataTypes.STRING(20), allowNull: true },
      medicalHistory: { type: DataTypes.TEXT, allowNull: true },
      allergies: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'Patient',
      tableName: 'Patients',
      indexes: [
        { unique: true, fields: ['patientCode'] },
        { fields: ['fullName'] },
        { fields: ['phone'] },
      ],
    }
  );

  Patient.associate = (models) => {
    Patient.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Patient.hasMany(models.Appointment, { foreignKey: 'patientId', as: 'appointments' });
    Patient.hasMany(models.MedicalRecord, { foreignKey: 'patientId', as: 'medicalRecords' });
    Patient.hasMany(models.Prescription, { foreignKey: 'patientId', as: 'prescriptions' });
    Patient.hasMany(models.Bill, { foreignKey: 'patientId', as: 'bills' });
  };

  return Patient;
};
