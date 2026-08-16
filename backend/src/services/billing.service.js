'use strict';

const { Bill, Patient, Appointment } = require('../models');
const { withTransaction } = require('../utils/transaction');
const { PAYMENT_STATUS } = require('../models/constants');
const ApiError = require('../utils/ApiError');
const { generateCode } = require('../utils/codes');

const CHARGE_FIELDS = [
  'consultationCharges',
  'medicineCharges',
  'testCharges',
  'roomCharges',
  'otherCharges',
];

function pickCharges(payload) {
  const charges = {};
  for (const field of CHARGE_FIELDS) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      const value = Number(payload[field]);
      if (!Number.isFinite(value) || value < 0) {
        throw ApiError.badRequest(`${field} must be a non-negative number`);
      }
      charges[field] = value;
    }
  }
  return charges;
}

async function createBill(payload, createdByUserId) {
  const patient = await Patient.findByPk(payload.patientId);
  if (!patient) throw ApiError.notFound('Patient not found');

  if (payload.appointmentId) {
    const appointment = await Appointment.findByPk(payload.appointmentId);
    if (!appointment) throw ApiError.notFound('Appointment not found');
    if (appointment.patientId !== patient.id) {
      throw ApiError.badRequest('Appointment does not belong to this patient');
    }
  }

  const charges = pickCharges(payload);
  const amountPaid = payload.amountPaid !== undefined ? Number(payload.amountPaid) : 0;
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    throw ApiError.badRequest('amountPaid must be a non-negative number');
  }

  return withTransaction(async (transaction) => {
    const billCode = await generateCode(Bill, 'BILL', { transaction });
    return Bill.create(
      {
        billCode,
        patientId: patient.id,
        appointmentId: payload.appointmentId || null,
        ...charges,
        amountPaid,
        paymentMethod: payload.paymentMethod || null,
        notes: payload.notes || null,
        createdByUserId: createdByUserId || null,
      },
      { transaction }
    );
  });
}

async function updateBill(bill, payload) {
  const charges = pickCharges(payload);
  Object.assign(bill, charges);

  if (payload.amountPaid !== undefined) {
    const amountPaid = Number(payload.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      throw ApiError.badRequest('amountPaid must be a non-negative number');
    }
    bill.amountPaid = amountPaid;
  }

  if (payload.paymentMethod !== undefined) bill.paymentMethod = payload.paymentMethod;
  if (payload.notes !== undefined) bill.notes = payload.notes;

  // Convenience: marking a bill "Paid" settles the outstanding balance.
  if (payload.paymentStatus === PAYMENT_STATUS.PAID) {
    bill.recalculate();
    bill.amountPaid = parseFloat(bill.getDataValue('totalAmount')) || 0;
  }

  await bill.save();
  return bill;
}

/** Records a payment against a bill; status is re-derived by the model hook. */
async function recordPayment(bill, amount, method) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw ApiError.badRequest('Payment amount must be greater than zero');
  }

  const total = parseFloat(bill.getDataValue('totalAmount')) || 0;
  const alreadyPaid = parseFloat(bill.getDataValue('amountPaid')) || 0;

  if (alreadyPaid + value > total + 0.001) {
    throw ApiError.badRequest(
      `Payment exceeds the outstanding balance of ${(total - alreadyPaid).toFixed(2)}`
    );
  }

  bill.amountPaid = Math.round((alreadyPaid + value) * 100) / 100;
  if (method) bill.paymentMethod = method;
  await bill.save();
  return bill;
}

module.exports = { createBill, updateBill, recordPayment, CHARGE_FIELDS };
