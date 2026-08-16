'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Prescriptions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      prescriptionCode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Patients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Appointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      medicalRecordId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'MedicalRecords', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      medicine: { type: Sequelize.STRING(160), allowNull: false },
      dosage: { type: Sequelize.STRING(80), allowNull: false },
      frequency: { type: Sequelize.STRING(80), allowNull: false },
      duration: { type: Sequelize.STRING(80), allowNull: false },
      instructions: { type: Sequelize.TEXT, allowNull: true },
      prescriptionDate: { type: Sequelize.DATEONLY, allowNull: false },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('Prescriptions', ['patientId'], { name: 'idx_prescriptions_patient' });
    await queryInterface.addIndex('Prescriptions', ['doctorId'], { name: 'idx_prescriptions_doctor' });
    await queryInterface.addIndex('Prescriptions', ['prescriptionDate'], { name: 'idx_prescriptions_date' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Prescriptions');
  },
};
