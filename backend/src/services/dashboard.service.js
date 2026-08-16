'use strict';

const { Op, fn, col, literal } = require('sequelize');
const {
  Patient,
  Doctor,
  Nurse,
  Department,
  Appointment,
  Prescription,
  MedicalRecord,
  Bill,
} = require('../models');
const { APPOINTMENT_STATUS, PAYMENT_STATUS } = require('../models/constants');

const APPOINTMENT_INCLUDES = [
  { model: Patient, as: 'patient', attributes: ['id', 'patientCode', 'fullName', 'phone'] },
  { model: Doctor, as: 'doctor', attributes: ['id', 'doctorCode', 'fullName', 'specialization'] },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function adminStats() {
  const [
    totalPatients,
    totalDoctors,
    totalNurses,
    totalDepartments,
    totalAppointments,
    pendingAppointments,
    confirmedAppointments,
    completedAppointments,
    cancelledAppointments,
    todaysAppointments,
    totalPrescriptions,
    totalRecords,
    unpaidBills,
  ] = await Promise.all([
    Patient.count(),
    Doctor.count(),
    Nurse.count(),
    Department.count(),
    Appointment.count(),
    Appointment.count({ where: { status: APPOINTMENT_STATUS.PENDING } }),
    Appointment.count({ where: { status: APPOINTMENT_STATUS.CONFIRMED } }),
    Appointment.count({ where: { status: APPOINTMENT_STATUS.COMPLETED } }),
    Appointment.count({ where: { status: APPOINTMENT_STATUS.CANCELLED } }),
    Appointment.count({ where: { appointmentDate: today() } }),
    Prescription.count(),
    MedicalRecord.count(),
    Bill.count({ where: { paymentStatus: { [Op.ne]: PAYMENT_STATUS.PAID } } }),
  ]);

  const revenueRow = await Bill.findOne({
    attributes: [
      [fn('COALESCE', fn('SUM', col('totalAmount')), 0), 'billed'],
      [fn('COALESCE', fn('SUM', col('amountPaid')), 0), 'collected'],
    ],
    raw: true,
  });

  const [recentPatients, recentAppointments, departmentBreakdown] = await Promise.all([
    Patient.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'patientCode', 'fullName', 'phone', 'gender', 'bloodGroup', 'createdAt'],
    }),
    Appointment.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: APPOINTMENT_INCLUDES,
    }),
    Department.findAll({
      attributes: [
        'id',
        'name',
        [
          literal(
            '(SELECT COUNT(*) FROM Doctors AS d WHERE d.departmentId = Department.id)'
          ),
          'doctorCount',
        ],
        [
          literal(
            '(SELECT COUNT(*) FROM Appointments AS a WHERE a.departmentId = Department.id)'
          ),
          'appointmentCount',
        ],
      ],
      order: [['name', 'ASC']],
    }),
  ]);

  return {
    counters: {
      totalPatients,
      totalDoctors,
      totalNurses,
      totalDepartments,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      todaysAppointments,
      totalPrescriptions,
      totalRecords,
      unpaidBills,
      totalBilled: parseFloat(revenueRow?.billed || 0),
      totalCollected: parseFloat(revenueRow?.collected || 0),
    },
    recentPatients,
    recentAppointments,
    departmentBreakdown,
  };
}

async function doctorStats(doctorId) {
  const [
    totalAppointments,
    pendingAppointments,
    confirmedAppointments,
    completedAppointments,
    todaysAppointments,
    totalPrescriptions,
    totalRecords,
  ] = await Promise.all([
    Appointment.count({ where: { doctorId } }),
    Appointment.count({ where: { doctorId, status: APPOINTMENT_STATUS.PENDING } }),
    Appointment.count({ where: { doctorId, status: APPOINTMENT_STATUS.CONFIRMED } }),
    Appointment.count({ where: { doctorId, status: APPOINTMENT_STATUS.COMPLETED } }),
    Appointment.count({ where: { doctorId, appointmentDate: today() } }),
    Prescription.count({ where: { doctorId } }),
    MedicalRecord.count({ where: { doctorId } }),
  ]);

  const distinctPatients = await Appointment.count({
    where: { doctorId },
    distinct: true,
    col: 'patientId',
  });

  const [upcoming, recentRecords] = await Promise.all([
    Appointment.findAll({
      where: {
        doctorId,
        appointmentDate: { [Op.gte]: today() },
        status: { [Op.in]: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
      },
      order: [
        ['appointmentDate', 'ASC'],
        ['appointmentTime', 'ASC'],
      ],
      limit: 8,
      include: APPOINTMENT_INCLUDES,
    }),
    MedicalRecord.findAll({
      where: { doctorId },
      order: [['recordDate', 'DESC']],
      limit: 5,
      include: [{ model: Patient, as: 'patient', attributes: ['id', 'patientCode', 'fullName'] }],
    }),
  ]);

  return {
    counters: {
      totalPatients: distinctPatients,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      todaysAppointments,
      totalPrescriptions,
      totalRecords,
    },
    upcomingAppointments: upcoming,
    recentRecords,
  };
}

async function nurseStats(nurse) {
  const departmentFilter = nurse.departmentId ? { departmentId: nurse.departmentId } : {};

  const [todaysAppointments, pendingAppointments, notesRecorded] = await Promise.all([
    Appointment.count({ where: { ...departmentFilter, appointmentDate: today() } }),
    Appointment.count({
      where: { ...departmentFilter, status: APPOINTMENT_STATUS.PENDING },
    }),
    MedicalRecord.count({ where: { nurseId: nurse.id } }),
  ]);

  const upcoming = await Appointment.findAll({
    where: {
      ...departmentFilter,
      appointmentDate: { [Op.gte]: today() },
      status: { [Op.in]: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
    },
    order: [
      ['appointmentDate', 'ASC'],
      ['appointmentTime', 'ASC'],
    ],
    limit: 8,
    include: APPOINTMENT_INCLUDES,
  });

  const assignedPatients = await Appointment.count({
    where: departmentFilter,
    distinct: true,
    col: 'patientId',
  });

  return {
    counters: {
      assignedPatients,
      todaysAppointments,
      pendingAppointments,
      notesRecorded,
    },
    upcomingAppointments: upcoming,
  };
}

async function receptionistStats() {
  const [
    totalPatients,
    totalDoctors,
    todaysAppointments,
    pendingAppointments,
    unpaidBills,
    registeredToday,
  ] = await Promise.all([
    Patient.count(),
    Doctor.count({ where: { isActive: true } }),
    Appointment.count({ where: { appointmentDate: today() } }),
    Appointment.count({ where: { status: APPOINTMENT_STATUS.PENDING } }),
    Bill.count({ where: { paymentStatus: { [Op.ne]: PAYMENT_STATUS.PAID } } }),
    Patient.count({ where: { createdAt: { [Op.gte]: `${today()} 00:00:00` } } }),
  ]);

  const todaysList = await Appointment.findAll({
    where: { appointmentDate: today() },
    order: [['appointmentTime', 'ASC']],
    limit: 10,
    include: APPOINTMENT_INCLUDES,
  });

  return {
    counters: {
      totalPatients,
      totalDoctors,
      todaysAppointments,
      pendingAppointments,
      unpaidBills,
      registeredToday,
    },
    todaysAppointments: todaysList,
  };
}

async function patientStats(patientId) {
  const [
    totalAppointments,
    upcomingCount,
    completedAppointments,
    totalPrescriptions,
    totalRecords,
  ] = await Promise.all([
    Appointment.count({ where: { patientId } }),
    Appointment.count({
      where: {
        patientId,
        appointmentDate: { [Op.gte]: today() },
        status: { [Op.in]: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
      },
    }),
    Appointment.count({ where: { patientId, status: APPOINTMENT_STATUS.COMPLETED } }),
    Prescription.count({ where: { patientId } }),
    MedicalRecord.count({ where: { patientId } }),
  ]);

  const billRow = await Bill.findOne({
    where: { patientId },
    attributes: [
      [fn('COALESCE', fn('SUM', col('totalAmount')), 0), 'billed'],
      [fn('COALESCE', fn('SUM', col('amountPaid')), 0), 'paid'],
    ],
    raw: true,
  });

  const [upcomingAppointments, recentPrescriptions] = await Promise.all([
    Appointment.findAll({
      where: {
        patientId,
        appointmentDate: { [Op.gte]: today() },
        status: { [Op.in]: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED] },
      },
      order: [
        ['appointmentDate', 'ASC'],
        ['appointmentTime', 'ASC'],
      ],
      limit: 5,
      include: APPOINTMENT_INCLUDES,
    }),
    Prescription.findAll({
      where: { patientId },
      order: [['prescriptionDate', 'DESC']],
      limit: 5,
      include: [{ model: Doctor, as: 'doctor', attributes: ['id', 'fullName', 'specialization'] }],
    }),
  ]);

  const billed = parseFloat(billRow?.billed || 0);
  const paid = parseFloat(billRow?.paid || 0);

  return {
    counters: {
      totalAppointments,
      upcomingAppointments: upcomingCount,
      completedAppointments,
      totalPrescriptions,
      totalRecords,
      totalBilled: billed,
      totalPaid: paid,
      outstandingBalance: Math.round((billed - paid) * 100) / 100,
    },
    upcomingAppointments,
    recentPrescriptions,
  };
}

module.exports = { adminStats, doctorStats, nurseStats, receptionistStats, patientStats };
