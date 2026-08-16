'use strict';

const {
  app,
  request,
  PASSWORD,
  resetDb,
  createAdmin,
  createReceptionist,
  createDoctor,
  createPatient,
  login,
  auth,
} = require('./helpers');

describe('Patient management', () => {
  let adminToken;

  beforeEach(async () => {
    await resetDb();
    const admin = await createAdmin({ email: 'admin.patients@test.local' });
    adminToken = await login(admin.email);
  });

  it('creates a patient with a generated patient code', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({
        fullName: 'Ananya Sharma',
        phone: '+91-9876543210',
        gender: 'Female',
        bloodGroup: 'B+',
        dateOfBirth: '1993-06-15',
        address: '42 Residency Road, Bengaluru',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.patientCode).toMatch(/^PAT-\d{6}$/);
    expect(res.body.data.fullName).toBe('Ananya Sharma');
  });

  it('rejects a patient without required fields', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({ fullName: 'No Phone' });

    expect(res.status).toBe(422);
  });

  it('creates a patient with a login when requested', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({
        fullName: 'Login Patient',
        phone: '+91-9876500000',
        email: 'login.patient@test.local',
        password: PASSWORD,
        createLogin: true,
      });

    expect(res.status).toBe(201);
    await expect(login('login.patient@test.local')).resolves.toEqual(expect.any(String));
  });

  it('gets a patient by id', async () => {
    const created = await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({ fullName: 'Fetch Me', phone: '+91-9800011111', dateOfBirth: '1990-05-20' });

    const res = await request(app)
      .get(`/api/patients/${created.body.data.id}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Fetch Me');
    expect(res.body.data.age).toBeGreaterThan(30);
  });

  it('returns 404 for a patient that does not exist', async () => {
    const res = await request(app).get('/api/patients/999999').set(auth(adminToken));
    expect(res.status).toBe(404);
  });

  it('updates a patient', async () => {
    const created = await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({ fullName: 'Before Update', phone: '+91-9800022222' });

    const res = await request(app)
      .put(`/api/patients/${created.body.data.id}`)
      .set(auth(adminToken))
      .send({ fullName: 'After Update', bloodGroup: 'AB-', allergies: 'Latex' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('After Update');
    expect(res.body.data.bloodGroup).toBe('AB-');
    expect(res.body.data.allergies).toBe('Latex');
  });

  it('searches patients by name', async () => {
    await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({ fullName: 'Searchable Person', phone: '+91-9800033333' });
    await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({ fullName: 'Someone Else', phone: '+91-9800044444' });

    const res = await request(app)
      .get('/api/patients?search=Searchable')
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].fullName).toBe('Searchable Person');
  });

  it('paginates the patient list', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/patients')
        .set(auth(adminToken))
        .send({ fullName: `Bulk Patient ${i}`, phone: `+91-98000555${i}0` });
    }

    const res = await request(app).get('/api/patients?page=1&limit=2').set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.totalPages).toBe(3);
    expect(res.body.pagination.hasNextPage).toBe(true);
  });

  it('deletes a patient with no clinical history', async () => {
    const created = await request(app)
      .post('/api/patients')
      .set(auth(adminToken))
      .send({ fullName: 'Delete Me', phone: '+91-9800066666' });

    const res = await request(app)
      .delete(`/api/patients/${created.body.data.id}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);

    const check = await request(app)
      .get(`/api/patients/${created.body.data.id}`)
      .set(auth(adminToken));
    expect(check.status).toBe(404);
  });

  describe('authorization', () => {
    it('lets a receptionist create patients', async () => {
      const receptionist = await createReceptionist({ email: 'recep.p@test.local' });
      const token = await login(receptionist.email);

      const res = await request(app)
        .post('/api/patients')
        .set(auth(token))
        .send({ fullName: 'Front Desk Patient', phone: '+91-9800077777' });

      expect(res.status).toBe(201);
    });

    it('stops a receptionist from deleting patients', async () => {
      const receptionist = await createReceptionist({ email: 'recep.d@test.local' });
      const token = await login(receptionist.email);
      const { patient } = await createPatient({ email: 'target@test.local' });

      const res = await request(app).delete(`/api/patients/${patient.id}`).set(auth(token));
      expect(res.status).toBe(403);
    });

    it('stops a patient from reading another patient record', async () => {
      const { user: patientUser } = await createPatient({ email: 'mine@test.local' });
      const { patient: otherPatient } = await createPatient({ email: 'theirs@test.local' });
      const token = await login(patientUser.email);

      const res = await request(app).get(`/api/patients/${otherPatient.id}`).set(auth(token));
      expect(res.status).toBe(403);
    });

    it('only returns the patient themselves in the patient list', async () => {
      const { user: patientUser } = await createPatient({ email: 'self@test.local' });
      await createPatient({ email: 'other1@test.local' });
      const token = await login(patientUser.email);

      const res = await request(app).get('/api/patients').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBe('self@test.local');
    });

    it('stops a doctor from seeing a patient with no appointment with them', async () => {
      const { user: doctorUser } = await createDoctor(null, { email: 'unlinked.doc@test.local' });
      const { patient } = await createPatient({ email: 'unrelated@test.local' });
      const token = await login(doctorUser.email);

      const res = await request(app).get(`/api/patients/${patient.id}`).set(auth(token));
      expect(res.status).toBe(403);
    });
  });
});
