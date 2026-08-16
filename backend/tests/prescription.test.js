'use strict';

const {
  app,
  request,
  resetDb,
  createAdmin,
  createDepartment,
  createDoctor,
  createPatient,
  login,
  auth,
  futureDate,
} = require('./helpers');

describe('Prescriptions & medical records', () => {
  let adminToken;
  let department;
  let doctor;
  let doctorToken;
  let patient;
  let patientToken;

  const validPrescription = () => ({
    medicine: 'Amoxicillin',
    dosage: '500 mg',
    frequency: 'Three times daily',
    duration: '7 days',
    instructions: 'Take after meals with water',
  });

  beforeEach(async () => {
    await resetDb();

    const admin = await createAdmin({ email: 'admin.rx@test.local' });
    adminToken = await login(admin.email);

    department = await createDepartment({ name: 'General Medicine' });

    const doc = await createDoctor(department, { email: 'rx.doc@test.local' });
    doctor = doc.doctor;
    doctorToken = await login(doc.user.email);

    const pat = await createPatient({ email: 'rx.patient@test.local' });
    patient = pat.patient;
    patientToken = await login(pat.user.email);

    // Link the doctor to the patient so scoping rules allow clinical writes.
    await request(app)
      .post('/api/appointments')
      .set(auth(patientToken))
      .send({
        doctorId: doctor.id,
        appointmentDate: futureDate(3),
        appointmentTime: '09:00',
        reason: 'Sore throat and fever',
      });
  });

  describe('prescriptions', () => {
    it('lets a doctor create a prescription for their patient', async () => {
      const res = await request(app)
        .post('/api/prescriptions')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, ...validPrescription() });

      expect(res.status).toBe(201);
      expect(res.body.data.prescriptionCode).toMatch(/^PRE-\d{6}$/);
      expect(res.body.data.medicine).toBe('Amoxicillin');
      expect(res.body.data.doctorId).toBe(doctor.id);
    });

    it('rejects a prescription missing required fields', async () => {
      const res = await request(app)
        .post('/api/prescriptions')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, medicine: 'Amoxicillin' });

      expect(res.status).toBe(422);
    });

    it('retrieves a prescription by id', async () => {
      const created = await request(app)
        .post('/api/prescriptions')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, ...validPrescription() });

      const res = await request(app)
        .get(`/api/prescriptions/${created.body.data.id}`)
        .set(auth(doctorToken));

      expect(res.status).toBe(200);
      expect(res.body.data.dosage).toBe('500 mg');
      expect(res.body.data.doctor.fullName).toEqual(expect.any(String));
    });

    it('lets the patient view their own prescriptions', async () => {
      await request(app)
        .post('/api/prescriptions')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, ...validPrescription() });

      const res = await request(app).get('/api/prescriptions').set(auth(patientToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientId).toBe(patient.id);
    });

    it('hides other patients prescriptions from a patient', async () => {
      await request(app)
        .post('/api/prescriptions')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, ...validPrescription() });

      const other = await createPatient({ email: 'rx.other@test.local' });
      const otherToken = await login(other.user.email);

      const res = await request(app).get('/api/prescriptions').set(auth(otherToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('stops a patient from writing a prescription', async () => {
      const res = await request(app)
        .post('/api/prescriptions')
        .set(auth(patientToken))
        .send({ patientId: patient.id, ...validPrescription() });

      expect(res.status).toBe(403);
    });

    it('lets the issuing doctor edit a prescription', async () => {
      const created = await request(app)
        .post('/api/prescriptions')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, ...validPrescription() });

      const res = await request(app)
        .put(`/api/prescriptions/${created.body.data.id}`)
        .set(auth(doctorToken))
        .send({ dosage: '250 mg', duration: '5 days' });

      expect(res.status).toBe(200);
      expect(res.body.data.dosage).toBe('250 mg');
      expect(res.body.data.duration).toBe('5 days');
    });

    it('stops a different doctor from editing a prescription', async () => {
      const created = await request(app)
        .post('/api/prescriptions')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, ...validPrescription() });

      const otherDoc = await createDoctor(department, { email: 'rx.otherdoc@test.local' });
      const otherToken = await login(otherDoc.user.email);

      const res = await request(app)
        .put(`/api/prescriptions/${created.body.data.id}`)
        .set(auth(otherToken))
        .send({ dosage: '999 mg' });

      expect(res.status).toBe(403);
    });
  });

  describe('medical records', () => {
    it('lets a doctor create a medical record', async () => {
      const res = await request(app)
        .post('/api/medical-records')
        .set(auth(doctorToken))
        .send({
          patientId: patient.id,
          diagnosis: 'Acute pharyngitis',
          symptoms: 'Sore throat, mild fever',
          treatment: 'Antibiotics for 7 days, rest',
          notes: 'Review if fever persists beyond 3 days',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.recordCode).toMatch(/^REC-\d{6}$/);
      expect(res.body.data.recordType).toBe('Consultation');
      expect(res.body.data.diagnosis).toBe('Acute pharyngitis');
    });

    it('lets the patient read but not write their record', async () => {
      const created = await request(app)
        .post('/api/medical-records')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, diagnosis: 'Acute pharyngitis' });

      const read = await request(app)
        .get(`/api/medical-records/${created.body.data.id}`)
        .set(auth(patientToken));
      expect(read.status).toBe(200);

      const write = await request(app)
        .post('/api/medical-records')
        .set(auth(patientToken))
        .send({ patientId: patient.id, diagnosis: 'Self diagnosed' });
      expect(write.status).toBe(403);
    });

    it('stops a patient from reading another patient record', async () => {
      const created = await request(app)
        .post('/api/medical-records')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, diagnosis: 'Private information' });

      const other = await createPatient({ email: 'rec.other@test.local' });
      const otherToken = await login(other.user.email);

      const res = await request(app)
        .get(`/api/medical-records/${created.body.data.id}`)
        .set(auth(otherToken));

      expect(res.status).toBe(403);
    });

    it('lets the issuing doctor update their record', async () => {
      const created = await request(app)
        .post('/api/medical-records')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, diagnosis: 'Initial diagnosis' });

      const res = await request(app)
        .put(`/api/medical-records/${created.body.data.id}`)
        .set(auth(doctorToken))
        .send({ diagnosis: 'Revised diagnosis', treatment: 'Updated plan' });

      expect(res.status).toBe(200);
      expect(res.body.data.diagnosis).toBe('Revised diagnosis');
    });

    it('accepts vitals recorded by a nurse in the same department', async () => {
      const { createNurse } = require('./helpers');
      const nurse = await createNurse(department, { email: 'vitals.nurse@test.local' });
      const nurseToken = await login(nurse.user.email);

      const res = await request(app)
        .post('/api/medical-records')
        .set(auth(nurseToken))
        .send({
          patientId: patient.id,
          recordType: 'Vitals',
          bloodPressure: '120/80',
          temperature: 37.1,
          pulse: 82,
          oxygenSaturation: 97,
          notes: 'Patient comfortable at rest',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.recordType).toBe('Vitals');
      expect(res.body.data.pulse).toBe(82);
      expect(res.body.data.nurseId).toBe(nurse.nurse.id);
    });

    it('ignores clinical fields a nurse is not allowed to write', async () => {
      const { createNurse } = require('./helpers');
      const nurse = await createNurse(department, { email: 'scope.nurse@test.local' });
      const nurseToken = await login(nurse.user.email);

      const res = await request(app)
        .post('/api/medical-records')
        .set(auth(nurseToken))
        .send({
          patientId: patient.id,
          recordType: 'Vitals',
          pulse: 78,
          diagnosis: 'Nurse should not be able to set this',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.diagnosis).toBeNull();
    });

    it('rejects out-of-range vitals', async () => {
      const res = await request(app)
        .post('/api/medical-records')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, diagnosis: 'Test', pulse: 900 });

      expect(res.status).toBe(422);
    });

    it('lets an admin list every record', async () => {
      await request(app)
        .post('/api/medical-records')
        .set(auth(doctorToken))
        .send({ patientId: patient.id, diagnosis: 'Admin visible' });

      const res = await request(app).get('/api/medical-records').set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
