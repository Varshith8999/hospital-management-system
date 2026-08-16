'use strict';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Patients', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      patientCode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fullName: { type: Sequelize.STRING(120), allowNull: false },
      dateOfBirth: { type: Sequelize.DATEONLY, allowNull: true },
      gender: { type: Sequelize.ENUM(...GENDERS), allowNull: true },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      email: { type: Sequelize.STRING(160), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      bloodGroup: { type: Sequelize.ENUM(...BLOOD_GROUPS), allowNull: false, defaultValue: 'Unknown' },
      emergencyContactName: { type: Sequelize.STRING(120), allowNull: true },
      emergencyContactPhone: { type: Sequelize.STRING(20), allowNull: true },
      medicalHistory: { type: Sequelize.TEXT, allowNull: true },
      allergies: { type: Sequelize.TEXT, allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('Patients', ['fullName'], { name: 'idx_patients_name' });
    await queryInterface.addIndex('Patients', ['phone'], { name: 'idx_patients_phone' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Patients');
  },
};
