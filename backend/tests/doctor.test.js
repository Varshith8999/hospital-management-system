'use strict';

const {
  app,
  request,
  PASSWORD,
  resetDb,
  createAdmin,
  createDepartment,
  createDoctor,
  createPatient,
  login,
  auth,
} = require('./helpers');

describe('Doctor & department management', () => {
  let adminToken;
  let department;

  beforeEach(async () => {
    await resetDb();
    const admin = await createAdmin({ email: 'admin.doctors@test.local' });
    adminToken = await login(admin.email);
    department = await createDepartment({ name: 'Cardiology' });
  });

  it('creates a doctor with a linked login account', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set(auth(adminToken))
      .send({
        fullName: 'Dr. Kavya Iyer',
        email: 'kavya.iyer@test.local',
        password: PASSWORD,
        specialization: 'Electrophysiology',
        departmentId: department.id,
        experienceYears: 12,
        consultationFee: 950,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.doctorCode).toMatch(/^DOC-\d{6}$/);
    expect(res.body.data.specialization).toBe('Electrophysiology');

    // The generated account can actually log in.
    await expect(login('kavya.iyer@test.local')).resolves.toEqual(expect.any(String));
  });

  it('rejects a doctor without a specialization', async () => {
    const res = await request(app).post('/api/doctors').set(auth(adminToken)).send({
      fullName: 'Dr. Missing Fields',
      email: 'missing@test.local',
      password: PASSWORD,
      departmentId: department.id,
    });

    expect(res.status).toBe(422);
  });

  it('rejects a doctor for an unknown department', async () => {
    const res = await request(app).post('/api/doctors').set(auth(adminToken)).send({
      fullName: 'Dr. No Department',
      email: 'nodept@test.local',
      password: PASSWORD,
      specialization: 'General',
      departmentId: 999999,
    });

    expect(res.status).toBe(400);
  });

  it('lists doctors with their department', async () => {
    await createDoctor(department, { email: 'listed.doc@test.local' });

    const res = await request(app).get('/api/doctors').set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].department.name).toBe('Cardiology');
    // Password hashes must never appear in a doctor payload.
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  it('filters doctors by department', async () => {
    const other = await createDepartment({ name: 'Neurology' });
    await createDoctor(department, { email: 'cardio@test.local' });
    await createDoctor(other, { email: 'neuro@test.local' });

    const res = await request(app)
      .get(`/api/doctors?departmentId=${other.id}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].department.name).toBe('Neurology');
  });

  it('searches doctors by specialization', async () => {
    await createDoctor(department, { email: 'spec@test.local', specialization: 'Arrhythmia Care' });

    const res = await request(app)
      .get('/api/doctors?search=Arrhythmia')
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('updates a doctor', async () => {
    const { doctor } = await createDoctor(department, { email: 'update.doc@test.local' });

    const res = await request(app)
      .put(`/api/doctors/${doctor.id}`)
      .set(auth(adminToken))
      .send({ consultationFee: 1200, experienceYears: 20, isAvailable: false });

    expect(res.status).toBe(200);
    expect(res.body.data.consultationFee).toBe(1200);
    expect(res.body.data.isAvailable).toBe(false);
  });

  it('deletes a doctor with no appointment history', async () => {
    const { doctor } = await createDoctor(department, { email: 'delete.doc@test.local' });

    const res = await request(app).delete(`/api/doctors/${doctor.id}`).set(auth(adminToken));
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/doctors/${doctor.id}`).set(auth(adminToken));
    expect(check.status).toBe(404);
  });

  it('exposes available slots for a doctor', async () => {
    const { doctor } = await createDoctor(department, { email: 'slots.doc@test.local' });

    // Find the next Monday - the helper seeds Monday availability.
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    const monday = d.toISOString().slice(0, 10);

    const res = await request(app)
      .get(`/api/doctors/${doctor.id}/slots?date=${monday}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.weekday).toBe('Monday');
    expect(res.body.data.slots.map((s) => s.time)).toContain('09:00');
  });

  it('lets a patient browse doctors but not create them', async () => {
    const { user } = await createPatient({ email: 'browser@test.local' });
    const token = await login(user.email);
    await createDoctor(department, { email: 'visible.doc@test.local' });

    const listRes = await request(app).get('/api/doctors').set(auth(token));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const createRes = await request(app).post('/api/doctors').set(auth(token)).send({
      fullName: 'Dr. Nope',
      email: 'nope@test.local',
      password: PASSWORD,
      specialization: 'General',
      departmentId: department.id,
    });
    expect(createRes.status).toBe(403);
  });

  describe('departments', () => {
    it('creates, updates and deletes a department', async () => {
      const created = await request(app)
        .post('/api/departments')
        .set(auth(adminToken))
        .send({ name: 'Radiology', description: 'Imaging services' });
      expect(created.status).toBe(201);

      const updated = await request(app)
        .put(`/api/departments/${created.body.data.id}`)
        .set(auth(adminToken))
        .send({ location: 'Basement' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.location).toBe('Basement');

      const deleted = await request(app)
        .delete(`/api/departments/${created.body.data.id}`)
        .set(auth(adminToken));
      expect(deleted.status).toBe(200);
    });

    it('rejects a duplicate department name', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set(auth(adminToken))
        .send({ name: 'Cardiology' });

      expect(res.status).toBe(409);
    });

    it('refuses to delete a department that still has doctors', async () => {
      await createDoctor(department, { email: 'blocking.doc@test.local' });

      const res = await request(app)
        .delete(`/api/departments/${department.id}`)
        .set(auth(adminToken));

      expect(res.status).toBe(409);
    });
  });
});
