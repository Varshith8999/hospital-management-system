'use strict';

const RECORD_TYPES = ['Consultation', 'Vitals', 'Nursing Note'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MedicalRecords', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      recordCode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Patients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nurseId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Nurses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Appointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      recordType: { type: Sequelize.ENUM(...RECORD_TYPES), allowNull: false, defaultValue: 'Consultation' },
      diagnosis: { type: Sequelize.TEXT, allowNull: true },
      symptoms: { type: Sequelize.TEXT, allowNull: true },
      treatment: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      bloodPressure: { type: Sequelize.STRING(20), allowNull: true },
      temperature: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      pulse: { type: Sequelize.INTEGER, allowNull: true },
      respirationRate: { type: Sequelize.INTEGER, allowNull: true },
      oxygenSaturation: { type: Sequelize.INTEGER, allowNull: true },
      weightKg: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      heightCm: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      recordDate: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('MedicalRecords', ['patientId'], { name: 'idx_records_patient' });
    await queryInterface.addIndex('MedicalRecords', ['doctorId'], { name: 'idx_records_doctor' });
    await queryInterface.addIndex('MedicalRecords', ['recordDate'], { name: 'idx_records_date' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MedicalRecords');
  },
};
