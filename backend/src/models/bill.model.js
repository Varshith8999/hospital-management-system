'use strict';

const { DataTypes, Model } = require('sequelize');
const { PAYMENT_STATUS, PAYMENT_STATUS_VALUES } = require('./constants');

const MONEY = (fieldName) => ({
  type: DataTypes.DECIMAL(10, 2),
  allowNull: false,
  defaultValue: 0,
  validate: { min: 0 },
  get() {
    const raw = this.getDataValue(fieldName);
    return raw === null || raw === undefined ? 0 : parseFloat(raw);
  },
});

const CHARGE_FIELDS = [
  'consultationCharges',
  'medicineCharges',
  'testCharges',
  'roomCharges',
  'otherCharges',
];

// Fields computed by the model rather than supplied by the caller.
const DERIVED_FIELDS = ['totalAmount', 'paymentStatus', 'paymentDate'];

module.exports = (sequelize) => {
  class Bill extends Model {
    /** Recomputes totalAmount and derives paymentStatus from amountPaid. */
    recalculate() {
      const total = CHARGE_FIELDS.reduce(
        (sum, field) => sum + (parseFloat(this.getDataValue(field)) || 0),
        0
      );
      const rounded = Math.round(total * 100) / 100;
      this.setDataValue('totalAmount', rounded);

      const paid = Math.round((parseFloat(this.getDataValue('amountPaid')) || 0) * 100) / 100;
      let status;
      if (paid <= 0) status = PAYMENT_STATUS.PENDING;
      else if (paid < rounded) status = PAYMENT_STATUS.PARTIALLY_PAID;
      else status = PAYMENT_STATUS.PAID;

      this.setDataValue('paymentStatus', status);

      if (status === PAYMENT_STATUS.PAID && !this.getDataValue('paymentDate')) {
        this.setDataValue('paymentDate', new Date());
      }
      if (status !== PAYMENT_STATUS.PAID && rounded === 0) {
        this.setDataValue('paymentDate', null);
      }
      return rounded;
    }

    get balanceDue() {
      const total = parseFloat(this.getDataValue('totalAmount')) || 0;
      const paid = parseFloat(this.getDataValue('amountPaid')) || 0;
      return Math.round((total - paid) * 100) / 100;
    }

    toJSON() {
      return { ...this.get(), balanceDue: this.balanceDue };
    }
  }

  Bill.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      billCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      patientId: { type: DataTypes.INTEGER, allowNull: false },
      appointmentId: { type: DataTypes.INTEGER, allowNull: true },
      consultationCharges: MONEY('consultationCharges'),
      medicineCharges: MONEY('medicineCharges'),
      testCharges: MONEY('testCharges'),
      roomCharges: MONEY('roomCharges'),
      otherCharges: MONEY('otherCharges'),
      totalAmount: MONEY('totalAmount'),
      amountPaid: MONEY('amountPaid'),
      paymentStatus: {
        type: DataTypes.ENUM(...PAYMENT_STATUS_VALUES),
        allowNull: false,
        defaultValue: PAYMENT_STATUS.PENDING,
      },
      paymentMethod: { type: DataTypes.STRING(40), allowNull: true },
      paymentDate: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Bill',
      tableName: 'Bills',
      indexes: [
        { unique: true, fields: ['billCode'] },
        { fields: ['patientId'] },
        { fields: ['paymentStatus'] },
      ],
      hooks: {
        beforeValidate: (bill) => bill.recalculate(),
        beforeSave: (bill, options) => {
          bill.recalculate();

          // Sequelize freezes the UPDATE column list before hooks run, so any
          // field derived here has to be added back or it is silently dropped.
          if (options && Array.isArray(options.fields)) {
            DERIVED_FIELDS.forEach((field) => {
              if (!options.fields.includes(field)) options.fields.push(field);
            });
          }
        },
      },
    }
  );

  Bill.associate = (models) => {
    Bill.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    Bill.belongsTo(models.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
  };

  return Bill;
};
