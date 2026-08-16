'use strict';

const express = require('express');

const router = express.Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/patients', require('./patient.routes'));
router.use('/doctors', require('./doctor.routes'));
router.use('/nurses', require('./nurse.routes'));
router.use('/departments', require('./department.routes'));
router.use('/appointments', require('./appointment.routes'));
router.use('/medical-records', require('./medicalRecord.routes'));
router.use('/prescriptions', require('./prescription.routes'));
router.use('/bills', require('./bill.routes'));
router.use('/dashboard', require('./dashboard.routes'));

router.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'Hospital Management System API',
    version: process.env.APP_VERSION || '1.0.0',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/users',
      '/api/patients',
      '/api/doctors',
      '/api/nurses',
      '/api/departments',
      '/api/appointments',
      '/api/medical-records',
      '/api/prescriptions',
      '/api/bills',
      '/api/dashboard',
    ],
  });
});

module.exports = router;
