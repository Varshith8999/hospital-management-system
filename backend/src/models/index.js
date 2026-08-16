'use strict';

const sequelize = require('../config/database');
const constants = require('./constants');

const db = {};

db.sequelize = sequelize;
db.Sequelize = require('sequelize');

db.User = require('./user.model')(sequelize);
db.Department = require('./department.model')(sequelize);
db.Patient = require('./patient.model')(sequelize);
db.Doctor = require('./doctor.model')(sequelize);
db.Nurse = require('./nurse.model')(sequelize);
db.Appointment = require('./appointment.model')(sequelize);
db.MedicalRecord = require('./medicalRecord.model')(sequelize);
db.Prescription = require('./prescription.model')(sequelize);
db.Bill = require('./bill.model')(sequelize);

Object.values(db)
  .filter((model) => model && typeof model.associate === 'function')
  .forEach((model) => model.associate(db));

db.constants = constants;

module.exports = db;
