'use strict';

const PAYMENT_STATUSES = ['Pending', 'Partially Paid', 'Paid'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const money = { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 };

    await queryInterface.createTable('Bills', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      billCode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Patients', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Appointments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      consultationCharges: { ...money },
      medicineCharges: { ...money },
      testCharges: { ...money },
      roomCharges: { ...money },
      otherCharges: { ...money },
      totalAmount: { ...money },
      amountPaid: { ...money },
      paymentStatus: { type: Sequelize.ENUM(...PAYMENT_STATUSES), allowNull: false, defaultValue: 'Pending' },
      paymentMethod: { type: Sequelize.STRING(40), allowNull: true },
      paymentDate: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
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

    await queryInterface.addIndex('Bills', ['patientId'], { name: 'idx_bills_patient' });
    await queryInterface.addIndex('Bills', ['paymentStatus'], { name: 'idx_bills_status' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Bills');
  },
};
