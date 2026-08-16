'use strict';

const {
  app,
  request,
  resetDb,
  createAdmin,
  createDepartment,
  createDoctor,
  createNurse,
  createReceptionist,
  createPatient,
  login,
  auth,
} = require('./helpers');

describe('Health check & dashboards', () => {
  beforeEach(resetDb);

  describe('GET /api/health', () => {
    it('returns 200 with status ok when the database is reachable', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.dependencies.database).toBe('up');
    });

    it('requires no authentication', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    });

    it('exposes a liveness probe', async () => {
      const res = await request(app).get('/api/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('errors', () => {
    it('returns a JSON 404 for an unknown route', async () => {
      const res = await request(app).get('/api/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": broken}');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/dashboard', () => {
    it('returns admin counters', async () => {
      const admin = await createAdmin({ email: 'dash.admin@test.local' });
      const dept = await createDepartment({ name: 'Cardiology' });
      await createDoctor(dept, { email: 'dash.doc@test.local' });
      await createPatient({ email: 'dash.pat@test.local' });
      const token = await login(admin.email);

      const res = await request(app).get('/api/dashboard').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('Admin');
      expect(res.body.data.counters.totalDoctors).toBe(1);
      expect(res.body.data.counters.totalPatients).toBe(1);
      expect(res.body.data.counters.totalDepartments).toBe(1);
      expect(Array.isArray(res.body.data.recentPatients)).toBe(true);
    });

    it('returns doctor counters', async () => {
      const { user } = await createDoctor(null, { email: 'dash.doctor@test.local' });
      const token = await login(user.email);

      const res = await request(app).get('/api/dashboard').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('Doctor');
      expect(res.body.data.counters).toHaveProperty('totalAppointments');
      expect(Array.isArray(res.body.data.upcomingAppointments)).toBe(true);
    });

    it('returns nurse counters', async () => {
      const { user } = await createNurse(null, { email: 'dash.nurse@test.local' });
      const token = await login(user.email);

      const res = await request(app).get('/api/dashboard').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('Nurse');
      expect(res.body.data.counters).toHaveProperty('assignedPatients');
    });

    it('returns receptionist counters', async () => {
      const receptionist = await createReceptionist({ email: 'dash.recep@test.local' });
      const token = await login(receptionist.email);

      const res = await request(app).get('/api/dashboard').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('Receptionist');
      expect(res.body.data.counters).toHaveProperty('todaysAppointments');
    });

    it('returns patient counters', async () => {
      const { user } = await createPatient({ email: 'dash.patient@test.local' });
      const token = await login(user.email);

      const res = await request(app).get('/api/dashboard').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('Patient');
      expect(res.body.data.counters).toHaveProperty('outstandingBalance');
    });

    it('rejects an unauthenticated dashboard request', async () => {
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(401);
    });
  });
});
