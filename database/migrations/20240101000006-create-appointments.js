'use strict';

const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rejected'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Appointments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      appointmentCode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
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
      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Departments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      appointmentDate: { type: Sequelize.DATEONLY, allowNull: false },
      appointmentTime: { type: Sequelize.STRING(5), allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.ENUM(...STATUSES), allowNull: false, defaultValue: 'Pending' },
      notes: { type: Sequelize.TEXT, allowNull: true },
      cancellationReason: { type: Sequelize.TEXT, allowNull: true },
      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Supports the double-booking lookup: (doctor, date, time).
    await queryInterface.addIndex('Appointments', ['doctorId', 'appointmentDate', 'appointmentTime'], {
      name: 'idx_doctor_slot',
    });
    await queryInterface.addIndex('Appointments', ['patientId', 'appointmentDate'], {
      name: 'idx_patient_date',
    });
    await queryInterface.addIndex('Appointments', ['status'], { name: 'idx_appointments_status' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Appointments');
  },
};
