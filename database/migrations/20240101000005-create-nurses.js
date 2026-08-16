'use strict';

const SHIFTS = ['Morning', 'Evening', 'Night', 'Rotational'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Nurses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nurseCode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
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
      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Departments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      shift: { type: Sequelize.ENUM(...SHIFTS), allowNull: false, defaultValue: 'Morning' },
      experienceYears: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('Nurses', ['departmentId'], { name: 'idx_nurses_department' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Nurses');
  },
};
