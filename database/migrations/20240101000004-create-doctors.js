'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Doctors', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      doctorCode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fullName: { type: Sequelize.STRING(120), allowNull: false },
      email: { type: Sequelize.STRING(160), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: true },
      specialization: { type: Sequelize.STRING(120), allowNull: false },
      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Departments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      experienceYears: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      qualification: { type: Sequelize.STRING(160), allowNull: true },
      consultationFee: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      availability: { type: Sequelize.JSON, allowNull: true },
      isAvailable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('Doctors', ['departmentId'], { name: 'idx_doctors_department' });
    await queryInterface.addIndex('Doctors', ['specialization'], { name: 'idx_doctors_specialization' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Doctors');
  },
};
