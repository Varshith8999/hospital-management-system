'use strict';

const {
  app,
  request,
  resetDb,
  createAdmin,
  createReceptionist,
  createDepartment,
  createDoctor,
  createPatient,
  login,
  auth,
  futureDate,
} = require('./helpers');

describe('Appointment management', () => {
  let adminToken;
  let department;
  let doctor;
  let doctorToken;
  let patient;
  let patientToken;
  let date;

  beforeEach(async () => {
    await resetDb();

    const admin = await createAdmin({ email: 'admin.appt@test.local' });
    adminToken = await login(admin.email);

    department = await createDepartment({ name: 'Cardiology' });

    const doc = await createDoctor(department, { email: 'appt.doc@test.local' });
    doctor = doc.doctor;
    doctorToken = await login(doc.user.email);

    const pat = await createPatient({ email: 'appt.patient@test.local' });
    patient = pat.patient;
    patientToken = await login(pat.user.email);

    date = futureDate(7);
  });

  const bookAs = (token, overrides = {}) =>
    request(app)
      .post('/api/appointments')
      .set(auth(token))
      .send({
        doctorId: doctor.id,
        appointmentDate: date,
        appointmentTime: '10:00',
        reason: 'Routine cardiac check-up',
        ...overrides,
      });

  it('lets a patient book an appointment for themselves', async () => {
    const res = await bookAs(patientToken);

    expect(res.status).toBe(201);
    expect(res.body.data.appointmentCode).toMatch(/^APT-\d{6}$/);
    expect(res.body.data.status).toBe('Pending');
    expect(res.body.data.patientId).toBe(patient.id);
    expect(res.body.data.departmentId).toBe(department.id);
  });

  it('lets a receptionist book on behalf of a patient', async () => {
    const receptionist = await createReceptionist({ email: 'recep.appt@test.local' });
    const token = await login(receptionist.email);

    const res = await bookAs(token, { patientId: patient.id });
    expect(res.status).toBe(201);
  });

  it('forces a patient booking to their own patient id', async () => {
    const other = await createPatient({ email: 'other.appt@test.local' });

    const res = await bookAs(patientToken, { patientId: other.patient.id });

    expect(res.status).toBe(201);
    expect(res.body.data.patientId).toBe(patient.id); // not the id they sent
  });

  describe('double-booking prevention', () => {
    it('rejects a second appointment for the same doctor, date and time', async () => {
      const first = await bookAs(patientToken);
      expect(first.status).toBe(201);

      const other = await createPatient({ email: 'clash.patient@test.local' });
      const otherToken = await login(other.user.email);

      const second = await request(app)
        .post('/api/appointments')
        .set(auth(otherToken))
        .send({
          doctorId: doctor.id,
          appointmentDate: date,
          appointmentTime: '10:00',
          reason: 'Different patient, same slot',
        });

      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/already has an appointment/i);
    });

    it('allows the same slot for a different doctor', async () => {
      await bookAs(patientToken);

      const second = await createDoctor(department, { email: 'second.doc@test.local' });
      const other = await createPatient({ email: 'second.patient@test.local' });
      const otherToken = await login(other.user.email);

      const res = await request(app)
        .post('/api/appointments')
        .set(auth(otherToken))
        .send({
          doctorId: second.doctor.id,
          appointmentDate: date,
          appointmentTime: '10:00',
          reason: 'Same time, different doctor',
        });

      expect(res.status).toBe(201);
    });

    it('stops one patient holding two appointments in the same slot', async () => {
      await bookAs(patientToken);

      const second = await createDoctor(department, { email: 'third.doc@test.local' });
      const res = await bookAs(patientToken, { doctorId: second.doctor.id });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already has an appointment/i);
    });

    it('allows the same doctor at a different time', async () => {
      await bookAs(patientToken);
      const res = await bookAs(patientToken, { appointmentTime: '10:30' });
      expect(res.status).toBe(201);
    });

    it('frees the slot again once the appointment is cancelled', async () => {
      const first = await bookAs(patientToken);
      await request(app)
        .patch(`/api/appointments/${first.body.data.id}/cancel`)
        .set(auth(patientToken))
        .send({ reason: 'Plans changed' });

      const other = await createPatient({ email: 'refill.patient@test.local' });
      const otherToken = await login(other.user.email);

      const res = await request(app)
        .post('/api/appointments')
        .set(auth(otherToken))
        .send({
          doctorId: doctor.id,
          appointmentDate: date,
          appointmentTime: '10:00',
          reason: 'Taking the freed slot',
        });

      expect(res.status).toBe(201);
    });

    it('rejects concurrent bookings for the same slot', async () => {
      const a = await createPatient({ email: 'race.a@test.local' });
      const b = await createPatient({ email: 'race.b@test.local' });
      const [tokenA, tokenB] = await Promise.all([login(a.user.email), login(b.user.email)]);

      const payload = {
        doctorId: doctor.id,
        appointmentDate: date,
        appointmentTime: '11:00',
        reason: 'Race condition check',
      };

      const results = await Promise.all([
        request(app).post('/api/appointments').set(auth(tokenA)).send(payload),
        request(app).post('/api/appointments').set(auth(tokenB)).send(payload),
      ]);

      const created = results.filter((r) => r.status === 201);
      expect(created).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('rejects a booking in the past', async () => {
      const res = await bookAs(patientToken, { appointmentDate: '2020-01-01' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/past/i);
    });

    it('rejects an invalid time format', async () => {
      const res = await bookAs(patientToken, { appointmentTime: '25:99' });
      expect(res.status).toBe(422);
    });

    it('rejects an unknown doctor', async () => {
      const res = await bookAs(patientToken, { doctorId: 999999 });
      expect(res.status).toBe(404);
    });

    it('rejects a booking with no reason', async () => {
      const res = await bookAs(patientToken, { reason: '' });
      expect(res.status).toBe(422);
    });
  });

  describe('status transitions', () => {
    let appointmentId;

    beforeEach(async () => {
      const res = await bookAs(patientToken);
      appointmentId = res.body.data.id;
    });

    it('lets the doctor confirm then complete an appointment', async () => {
      const confirmed = await request(app)
        .patch(`/api/appointments/${appointmentId}/confirm`)
        .set(auth(doctorToken));
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.data.status).toBe('Confirmed');

      const completed = await request(app)
        .patch(`/api/appointments/${appointmentId}/complete`)
        .set(auth(doctorToken))
        .send({ notes: 'Patient seen, follow-up in 3 months' });
      expect(completed.status).toBe(200);
      expect(completed.body.data.status).toBe('Completed');
    });

    it('lets the doctor reject a pending appointment', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${appointmentId}/reject`)
        .set(auth(doctorToken))
        .send({ reason: 'Unavailable that day' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Rejected');
    });

    it('rejects completing an appointment that was never confirmed', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${appointmentId}/complete`)
        .set(auth(doctorToken));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot change an appointment/i);
    });

    it('rejects cancelling an already completed appointment', async () => {
      await request(app)
        .patch(`/api/appointments/${appointmentId}/confirm`)
        .set(auth(doctorToken));
      await request(app)
        .patch(`/api/appointments/${appointmentId}/complete`)
        .set(auth(doctorToken));

      const res = await request(app)
        .patch(`/api/appointments/${appointmentId}/cancel`)
        .set(auth(patientToken));

      expect(res.status).toBe(400);
    });

    it('lets a patient cancel their own appointment', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${appointmentId}/cancel`)
        .set(auth(patientToken))
        .send({ reason: 'Feeling better' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Cancelled');
      expect(res.body.data.cancellationReason).toBe('Feeling better');
    });

    it('stops a patient from confirming their own appointment', async () => {
      const res = await request(app)
        .patch(`/api/appointments/${appointmentId}/confirm`)
        .set(auth(patientToken));

      expect(res.status).toBe(403);
    });
  });

  describe('rescheduling', () => {
    it('moves an appointment to a free slot', async () => {
      const booked = await bookAs(patientToken);

      const res = await request(app)
        .patch(`/api/appointments/${booked.body.data.id}/reschedule`)
        .set(auth(patientToken))
        .send({ appointmentDate: futureDate(9), appointmentTime: '14:30' });

      expect(res.status).toBe(200);
      expect(res.body.data.appointmentTime).toBe('14:30');
      expect(res.body.data.status).toBe('Pending');
    });

    it('refuses to reschedule onto an occupied slot', async () => {
      const first = await bookAs(patientToken);
      const other = await createPatient({ email: 'occupier@test.local' });
      const otherToken = await login(other.user.email);

      await request(app).post('/api/appointments').set(auth(otherToken)).send({
        doctorId: doctor.id,
        appointmentDate: date,
        appointmentTime: '16:00',
        reason: 'Occupying the target slot',
      });

      const res = await request(app)
        .patch(`/api/appointments/${first.body.data.id}/reschedule`)
        .set(auth(patientToken))
        .send({ appointmentTime: '16:00' });

      expect(res.status).toBe(409);
    });
  });

  describe('listing & scoping', () => {
    it('shows a patient only their own appointments', async () => {
      await bookAs(patientToken);

      const other = await createPatient({ email: 'listing.other@test.local' });
      const otherToken = await login(other.user.email);
      await request(app).post('/api/appointments').set(auth(otherToken)).send({
        doctorId: doctor.id,
        appointmentDate: date,
        appointmentTime: '12:00',
        reason: 'Someone else booking',
      });

      const res = await request(app).get('/api/appointments').set(auth(patientToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientId).toBe(patient.id);
    });

    it('shows the doctor their own appointments only', async () => {
      await bookAs(patientToken);

      const otherDoc = await createDoctor(department, { email: 'other.listing.doc@test.local' });
      const otherDocToken = await login(otherDoc.user.email);

      const mine = await request(app).get('/api/appointments').set(auth(doctorToken));
      const theirs = await request(app).get('/api/appointments').set(auth(otherDocToken));

      expect(mine.body.data).toHaveLength(1);
      expect(theirs.body.data).toHaveLength(0);
    });

    it('shows an admin every appointment', async () => {
      await bookAs(patientToken);
      const res = await request(app).get('/api/appointments').set(auth(adminToken));
      expect(res.body.data).toHaveLength(1);
    });

    it('filters by status', async () => {
      const booked = await bookAs(patientToken);
      await request(app)
        .patch(`/api/appointments/${booked.body.data.id}/confirm`)
        .set(auth(doctorToken));
      await bookAs(patientToken, { appointmentTime: '13:00' });

      const res = await request(app)
        .get('/api/appointments?status=Confirmed')
        .set(auth(adminToken));

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('Confirmed');
    });

    it('blocks a patient from reading another patient appointment', async () => {
      const booked = await bookAs(patientToken);
      const other = await createPatient({ email: 'nosy@test.local' });
      const otherToken = await login(other.user.email);

      const res = await request(app)
        .get(`/api/appointments/${booked.body.data.id}`)
        .set(auth(otherToken));

      expect(res.status).toBe(403);
    });
  });
});
