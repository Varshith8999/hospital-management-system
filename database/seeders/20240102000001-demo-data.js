'use strict';

const path = require('path');

// This file lives outside backend/, so Node's normal upward lookup never
// reaches backend/node_modules. Resolve dependencies from there explicitly -
// this holds both locally and inside the Docker image (/app/backend, /app/database).
const backendModules = path.resolve(__dirname, '..', '..', 'backend', 'node_modules');
// eslint-disable-next-line import/no-dynamic-require
const bcrypt = require(require.resolve('bcryptjs', { paths: [backendModules, __dirname] }));

/**
 * Demo / test data so the application is usable immediately after a fresh
 * `db:migrate`. The password is taken from SEED_PASSWORD when provided.
 */
const PASSWORD = process.env.SEED_PASSWORD || 'Password@123';
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

const now = new Date();
const stamp = () => new Date();

function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEPARTMENTS = [
  ['Cardiology', 'Heart and cardiovascular care', 'Block A, Floor 2'],
  ['Neurology', 'Brain, spine and nervous system', 'Block A, Floor 3'],
  ['Orthopedics', 'Bones, joints and musculoskeletal care', 'Block B, Floor 1'],
  ['Pediatrics', 'Healthcare for infants, children and adolescents', 'Block C, Floor 1'],
  ['Dermatology', 'Skin, hair and nail conditions', 'Block B, Floor 2'],
  ['General Medicine', 'Primary diagnosis and general treatment', 'Block A, Floor 1'],
  ['Radiology', 'Imaging, X-ray, CT and MRI services', 'Basement, Floor -1'],
  ['Emergency', '24x7 emergency and trauma care', 'Ground Floor, Gate 1'],
];

const WEEK_SLOTS = {
  Monday: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'],
  Tuesday: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'],
  Wednesday: ['09:00', '09:30', '10:00', '10:30', '11:00'],
  Thursday: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'],
  Friday: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30'],
  Saturday: ['10:00', '10:30', '11:00', '11:30'],
  Sunday: [],
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const hash = await bcrypt.hash(PASSWORD, ROUNDS);

    /* ---------------------------------------------------------- Departments */
    await queryInterface.bulkInsert(
      'Departments',
      DEPARTMENTS.map(([name, description, location], i) => ({
        name,
        description,
        location,
        phone: `080-4000-${String(1000 + i)}`,
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      }))
    );

    const departments = await queryInterface.sequelize.query(
      'SELECT id, name FROM Departments',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const deptId = (name) => departments.find((d) => d.name === name).id;

    /* --------------------------------------------------------------- Users */
    const userRows = [
      ['System Administrator', 'admin@hospital.test', 'Admin', '+91-9800000001'],
      ['Dr. Arjun Mehta', 'arjun.mehta@hospital.test', 'Doctor', '+91-9800000011'],
      ['Dr. Priya Nair', 'priya.nair@hospital.test', 'Doctor', '+91-9800000012'],
      ['Dr. Rahul Verma', 'rahul.verma@hospital.test', 'Doctor', '+91-9800000013'],
      ['Dr. Sneha Kulkarni', 'sneha.kulkarni@hospital.test', 'Doctor', '+91-9800000014'],
      ['Nurse Anita Rao', 'anita.rao@hospital.test', 'Nurse', '+91-9800000021'],
      ['Nurse Vikram Singh', 'vikram.singh@hospital.test', 'Nurse', '+91-9800000022'],
      ['Reception Desk', 'reception@hospital.test', 'Receptionist', '+91-9800000031'],
      ['Ravi Kumar', 'ravi.kumar@example.test', 'Patient', '+91-9800000041'],
      ['Meera Joshi', 'meera.joshi@example.test', 'Patient', '+91-9800000042'],
      ['Sanjay Patel', 'sanjay.patel@example.test', 'Patient', '+91-9800000043'],
      ['Fatima Sheikh', 'fatima.sheikh@example.test', 'Patient', '+91-9800000044'],
    ];

    await queryInterface.bulkInsert(
      'Users',
      userRows.map(([fullName, email, role, phone]) => ({
        fullName,
        email,
        password: hash,
        role,
        phone,
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      }))
    );

    const users = await queryInterface.sequelize.query('SELECT id, email FROM Users', {
      type: Sequelize.QueryTypes.SELECT,
    });
    const userId = (email) => users.find((u) => u.email === email).id;

    /* ------------------------------------------------------------- Doctors */
    const doctorRows = [
      ['DOC-000001', 'arjun.mehta@hospital.test', 'Dr. Arjun Mehta', 'Interventional Cardiology', 'Cardiology', 14, 'MBBS, MD, DM (Cardiology)', 800],
      ['DOC-000002', 'priya.nair@hospital.test', 'Dr. Priya Nair', 'Clinical Neurology', 'Neurology', 9, 'MBBS, MD, DM (Neurology)', 900],
      ['DOC-000003', 'rahul.verma@hospital.test', 'Dr. Rahul Verma', 'Joint Replacement', 'Orthopedics', 11, 'MBBS, MS (Ortho)', 700],
      ['DOC-000004', 'sneha.kulkarni@hospital.test', 'Dr. Sneha Kulkarni', 'General Pediatrics', 'Pediatrics', 7, 'MBBS, MD (Pediatrics)', 600],
    ];

    await queryInterface.bulkInsert(
      'Doctors',
      doctorRows.map(([doctorCode, email, fullName, specialization, department, exp, qualification, fee]) => ({
        doctorCode,
        userId: userId(email),
        fullName,
        email,
        phone: users.find((u) => u.email === email) ? `+91-98000000${doctorCode.slice(-2)}` : null,
        specialization,
        departmentId: deptId(department),
        experienceYears: exp,
        qualification,
        consultationFee: fee,
        availability: JSON.stringify(WEEK_SLOTS),
        isAvailable: true,
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      }))
    );

    /* -------------------------------------------------------------- Nurses */
    await queryInterface.bulkInsert('Nurses', [
      {
        nurseCode: 'NUR-000001',
        userId: userId('anita.rao@hospital.test'),
        fullName: 'Nurse Anita Rao',
        email: 'anita.rao@hospital.test',
        phone: '+91-9800000021',
        departmentId: deptId('Cardiology'),
        shift: 'Morning',
        experienceYears: 6,
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      },
      {
        nurseCode: 'NUR-000002',
        userId: userId('vikram.singh@hospital.test'),
        fullName: 'Nurse Vikram Singh',
        email: 'vikram.singh@hospital.test',
        phone: '+91-9800000022',
        departmentId: deptId('Emergency'),
        shift: 'Night',
        experienceYears: 4,
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      },
    ]);

    /* ------------------------------------------------------------ Patients */
    const patientRows = [
      ['PAT-000001', 'ravi.kumar@example.test', 'Ravi Kumar', '1988-04-12', 'Male', 'O+', 'Hypertension since 2019', 'Penicillin'],
      ['PAT-000002', 'meera.joshi@example.test', 'Meera Joshi', '1995-11-30', 'Female', 'A+', 'No significant history', 'None known'],
      ['PAT-000003', 'sanjay.patel@example.test', 'Sanjay Patel', '1972-01-25', 'Male', 'B+', 'Type 2 diabetes, knee osteoarthritis', 'Sulfa drugs'],
      ['PAT-000004', 'fatima.sheikh@example.test', 'Fatima Sheikh', '2015-07-08', 'Female', 'AB+', 'Childhood asthma', 'Dust mites'],
    ];

    await queryInterface.bulkInsert(
      'Patients',
      patientRows.map(([patientCode, email, fullName, dob, gender, bloodGroup, history, allergies], i) => ({
        patientCode,
        userId: userId(email),
        fullName,
        dateOfBirth: dob,
        gender,
        phone: `+91-98000000${41 + i}`,
        email,
        address: `${12 + i} MG Road, Bengaluru, Karnataka 5600${i}1`,
        bloodGroup,
        emergencyContactName: ['Sunita Kumar', 'Anil Joshi', 'Rekha Patel', 'Imran Sheikh'][i],
        emergencyContactPhone: `+91-97000000${41 + i}`,
        medicalHistory: history,
        allergies,
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      }))
    );

    const patients = await queryInterface.sequelize.query(
      'SELECT id, patientCode FROM Patients',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const doctors = await queryInterface.sequelize.query(
      'SELECT id, doctorCode, departmentId FROM Doctors',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const nurses = await queryInterface.sequelize.query('SELECT id, nurseCode FROM Nurses', {
      type: Sequelize.QueryTypes.SELECT,
    });

    const pid = (code) => patients.find((p) => p.patientCode === code).id;
    const doc = (code) => doctors.find((d) => d.doctorCode === code);
    const nid = (code) => nurses.find((n) => n.nurseCode === code).id;

    /* -------------------------------------------------------- Appointments */
    const appointmentRows = [
      ['APT-000001', 'PAT-000001', 'DOC-000001', dayOffset(-14), '09:00', 'Chest tightness during exertion', 'Completed'],
      ['APT-000002', 'PAT-000003', 'DOC-000003', dayOffset(-7), '10:30', 'Persistent right knee pain', 'Completed'],
      ['APT-000003', 'PAT-000002', 'DOC-000002', dayOffset(-3), '11:00', 'Recurring migraines', 'Completed'],
      ['APT-000004', 'PAT-000001', 'DOC-000001', dayOffset(2), '09:30', 'Follow-up on blood pressure medication', 'Confirmed'],
      ['APT-000005', 'PAT-000004', 'DOC-000004', dayOffset(3), '10:00', 'Routine asthma review', 'Confirmed'],
      ['APT-000006', 'PAT-000002', 'DOC-000002', dayOffset(4), '14:00', 'MRI report discussion', 'Pending'],
      ['APT-000007', 'PAT-000003', 'DOC-000003', dayOffset(5), '10:30', 'Physiotherapy plan review', 'Pending'],
      ['APT-000008', 'PAT-000004', 'DOC-000004', dayOffset(6), '11:00', 'Vaccination schedule', 'Pending'],
      ['APT-000009', 'PAT-000001', 'DOC-000002', dayOffset(-1), '15:00', 'Second opinion on dizziness', 'Cancelled'],
    ];

    await queryInterface.bulkInsert(
      'Appointments',
      appointmentRows.map(([appointmentCode, patientCode, doctorCode, date, time, reason, status]) => ({
        appointmentCode,
        patientId: pid(patientCode),
        doctorId: doc(doctorCode).id,
        departmentId: doc(doctorCode).departmentId,
        appointmentDate: date,
        appointmentTime: time,
        reason,
        status,
        notes: status === 'Completed' ? 'Consultation completed, notes recorded.' : null,
        cancellationReason: status === 'Cancelled' ? 'Patient rescheduled privately' : null,
        createdByUserId: userId('reception@hospital.test'),
        createdAt: stamp(),
        updatedAt: stamp(),
      }))
    );

    const appointments = await queryInterface.sequelize.query(
      'SELECT id, appointmentCode FROM Appointments',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const aid = (code) => appointments.find((a) => a.appointmentCode === code).id;

    /* ------------------------------------------------------ MedicalRecords */
    await queryInterface.bulkInsert('MedicalRecords', [
      {
        recordCode: 'REC-000001',
        patientId: pid('PAT-000001'),
        doctorId: doc('DOC-000001').id,
        nurseId: null,
        appointmentId: aid('APT-000001'),
        recordType: 'Consultation',
        diagnosis: 'Stable angina, controlled hypertension',
        symptoms: 'Chest tightness on exertion, occasional breathlessness',
        treatment: 'Continue antihypertensives, add statin, stress test advised',
        notes: 'Advised 30 minutes of daily walking and a low-sodium diet.',
        bloodPressure: '138/88',
        temperature: 36.8,
        pulse: 78,
        respirationRate: 16,
        oxygenSaturation: 98,
        weightKg: 82.5,
        heightCm: 174,
        recordDate: new Date(`${dayOffset(-14)}T09:20:00`),
        createdAt: stamp(),
        updatedAt: stamp(),
      },
      {
        recordCode: 'REC-000002',
        patientId: pid('PAT-000003'),
        doctorId: doc('DOC-000003').id,
        nurseId: null,
        appointmentId: aid('APT-000002'),
        recordType: 'Consultation',
        diagnosis: 'Grade 2 osteoarthritis, right knee',
        symptoms: 'Morning stiffness, pain climbing stairs',
        treatment: 'NSAIDs for 10 days, physiotherapy twice weekly',
        notes: 'X-ray shows moderate joint space narrowing.',
        bloodPressure: '129/84',
        temperature: 36.6,
        pulse: 74,
        respirationRate: 15,
        oxygenSaturation: 99,
        weightKg: 91,
        heightCm: 168,
        recordDate: new Date(`${dayOffset(-7)}T10:45:00`),
        createdAt: stamp(),
        updatedAt: stamp(),
      },
      {
        recordCode: 'REC-000003',
        patientId: pid('PAT-000002'),
        doctorId: doc('DOC-000002').id,
        nurseId: null,
        appointmentId: aid('APT-000003'),
        recordType: 'Consultation',
        diagnosis: 'Migraine without aura',
        symptoms: 'Unilateral throbbing headache, photophobia, nausea',
        treatment: 'Abortive therapy prescribed; trigger diary advised',
        notes: 'Refer to neurology imaging if frequency increases.',
        bloodPressure: '118/76',
        temperature: 36.9,
        pulse: 70,
        respirationRate: 14,
        oxygenSaturation: 99,
        weightKg: 58,
        heightCm: 162,
        recordDate: new Date(`${dayOffset(-3)}T11:15:00`),
        createdAt: stamp(),
        updatedAt: stamp(),
      },
      {
        recordCode: 'REC-000004',
        patientId: pid('PAT-000001'),
        doctorId: null,
        nurseId: nid('NUR-000001'),
        appointmentId: null,
        recordType: 'Vitals',
        diagnosis: null,
        symptoms: null,
        treatment: null,
        notes: 'Pre-consultation vitals recorded at the cardiology desk.',
        bloodPressure: '134/86',
        temperature: 36.7,
        pulse: 76,
        respirationRate: 16,
        oxygenSaturation: 98,
        weightKg: 82.1,
        heightCm: 174,
        recordDate: new Date(`${dayOffset(-1)}T08:50:00`),
        createdAt: stamp(),
        updatedAt: stamp(),
      },
    ]);

    const records = await queryInterface.sequelize.query(
      'SELECT id, recordCode FROM MedicalRecords',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const rid = (code) => records.find((r) => r.recordCode === code).id;

    /* --------------------------------------------------------Prescriptions */
    await queryInterface.bulkInsert('Prescriptions', [
      {
        prescriptionCode: 'PRE-000001',
        patientId: pid('PAT-000001'),
        doctorId: doc('DOC-000001').id,
        appointmentId: aid('APT-000001'),
        medicalRecordId: rid('REC-000001'),
        medicine: 'Atorvastatin',
        dosage: '10 mg',
        frequency: 'Once daily at night',
        duration: '90 days',
        instructions: 'Take after dinner. Report any muscle pain immediately.',
        prescriptionDate: dayOffset(-14),
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      },
      {
        prescriptionCode: 'PRE-000002',
        patientId: pid('PAT-000001'),
        doctorId: doc('DOC-000001').id,
        appointmentId: aid('APT-000001'),
        medicalRecordId: rid('REC-000001'),
        medicine: 'Amlodipine',
        dosage: '5 mg',
        frequency: 'Once daily in the morning',
        duration: '90 days',
        instructions: 'Monitor blood pressure twice a week.',
        prescriptionDate: dayOffset(-14),
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      },
      {
        prescriptionCode: 'PRE-000003',
        patientId: pid('PAT-000003'),
        doctorId: doc('DOC-000003').id,
        appointmentId: aid('APT-000002'),
        medicalRecordId: rid('REC-000002'),
        medicine: 'Naproxen',
        dosage: '250 mg',
        frequency: 'Twice daily after meals',
        duration: '10 days',
        instructions: 'Stop if stomach discomfort develops.',
        prescriptionDate: dayOffset(-7),
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      },
      {
        prescriptionCode: 'PRE-000004',
        patientId: pid('PAT-000002'),
        doctorId: doc('DOC-000002').id,
        appointmentId: aid('APT-000003'),
        medicalRecordId: rid('REC-000003'),
        medicine: 'Sumatriptan',
        dosage: '50 mg',
        frequency: 'At onset of migraine, max 2 doses in 24 hours',
        duration: 'As needed',
        instructions: 'Do not exceed two tablets in a single day.',
        prescriptionDate: dayOffset(-3),
        isActive: true,
        createdAt: stamp(),
        updatedAt: stamp(),
      },
    ]);

    /* --------------------------------------------------------------- Bills */
    const bills = [
      ['BILL-000001', 'PAT-000001', 'APT-000001', 800, 1250.5, 2400, 0, 150, 4600.5, 'Paid', 'Card'],
      ['BILL-000002', 'PAT-000003', 'APT-000002', 700, 480, 1800, 0, 100, 1500, 'Partially Paid', 'UPI'],
      ['BILL-000003', 'PAT-000002', 'APT-000003', 900, 320.75, 0, 0, 0, 0, 'Pending', null],
    ];

    await queryInterface.bulkInsert(
      'Bills',
      bills.map(
        ([billCode, patientCode, apptCode, consult, medicine, test, room, other, paid, status, method]) => {
          const total =
            Math.round((consult + medicine + test + room + other) * 100) / 100;
          return {
            billCode,
            patientId: pid(patientCode),
            appointmentId: aid(apptCode),
            consultationCharges: consult,
            medicineCharges: medicine,
            testCharges: test,
            roomCharges: room,
            otherCharges: other,
            totalAmount: total,
            amountPaid: paid,
            paymentStatus: status,
            paymentMethod: method,
            paymentDate: status === 'Paid' ? now : null,
            notes: null,
            createdByUserId: userId('reception@hospital.test'),
            createdAt: stamp(),
            updatedAt: stamp(),
          };
        }
      )
    );
  },

  async down(queryInterface) {
    // Reverse dependency order.
    await queryInterface.bulkDelete('Bills', null, {});
    await queryInterface.bulkDelete('Prescriptions', null, {});
    await queryInterface.bulkDelete('MedicalRecords', null, {});
    await queryInterface.bulkDelete('Appointments', null, {});
    await queryInterface.bulkDelete('Patients', null, {});
    await queryInterface.bulkDelete('Nurses', null, {});
    await queryInterface.bulkDelete('Doctors', null, {});
    await queryInterface.bulkDelete('Departments', null, {});
    await queryInterface.bulkDelete('Users', null, {});
  },
};
