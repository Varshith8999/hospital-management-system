'use strict';

const {
  app,
  request,
  PASSWORD,
  resetDb,
  createAdmin,
  createDoctor,
  login,
  auth,
} = require('./helpers');
const { User, Patient } = require('../src/models');

describe('Authentication', () => {
  beforeEach(resetDb);

  describe('POST /api/auth/register', () => {
    it('registers a patient, hashes the password and returns a JWT', async () => {
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'New Patient',
        email: 'new.patient@test.local',
        password: PASSWORD,
        phone: '+91-9812345678',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.role).toBe('Patient');
      expect(res.body.user.password).toBeUndefined();

      const stored = await User.findOne({ where: { email: 'new.patient@test.local' } });
      expect(stored).not.toBeNull();
      expect(stored.password).not.toBe(PASSWORD);
      expect(stored.password.startsWith('$2')).toBe(true);

      // A linked patient profile is created automatically.
      const profile = await Patient.findOne({ where: { userId: stored.id } });
      expect(profile).not.toBeNull();
      expect(profile.patientCode).toMatch(/^PAT-\d{6}$/);
    });

    it('rejects a duplicate email with 409', async () => {
      const payload = {
        fullName: 'Dup User',
        email: 'dup@test.local',
        password: PASSWORD,
      };
      await request(app).post('/api/auth/register').send(payload);
      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects a weak password with 422', async () => {
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'Weak Password',
        email: 'weak@test.local',
        password: 'abc',
      });

      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
    });

    it('rejects an invalid email with 422', async () => {
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'Bad Email',
        email: 'not-an-email',
        password: PASSWORD,
      });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Login User',
        email: 'login@test.local',
        password: PASSWORD,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.local', password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(res.body.profile).not.toBeNull();
    });

    it('rejects an invalid password with 401', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Login User',
        email: 'login2@test.local',
        password: PASSWORD,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login2@test.local', password: 'WrongPassword1' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects an unknown email with the same 401 message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.local', password: PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects a deactivated account with 403', async () => {
      const admin = await createAdmin({ email: 'inactive@test.local' });
      admin.isActive = false;
      await admin.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inactive@test.local', password: PASSWORD });

      expect(res.status).toBe(403);
    });
  });

  describe('Protected routes', () => {
    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/patients');
      expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const res = await request(app).get('/api/patients').set(auth('not.a.real.token'));
      expect(res.status).toBe(401);
    });

    it('returns the current user for GET /api/auth/me', async () => {
      const admin = await createAdmin({ email: 'me@test.local' });
      const token = await login(admin.email);

      const res = await request(app).get('/api/auth/me').set(auth(token));

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('me@test.local');
      expect(res.body.user.role).toBe('Admin');
    });

    it('logs out successfully', async () => {
      const admin = await createAdmin();
      const token = await login(admin.email);

      const res = await request(app).post('/api/auth/logout').set(auth(token));
      expect(res.status).toBe(200);
    });
  });

  describe('Role-based authorization', () => {
    it('blocks a patient from the admin-only users endpoint', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'RBAC Patient',
        email: 'rbac.patient@test.local',
        password: PASSWORD,
      });
      const token = await login('rbac.patient@test.local');

      const res = await request(app).get('/api/users').set(auth(token));
      expect(res.status).toBe(403);
    });

    it('blocks a doctor from creating departments', async () => {
      const { user } = await createDoctor();
      const token = await login(user.email);

      const res = await request(app)
        .post('/api/departments')
        .set(auth(token))
        .send({ name: 'Should Not Exist' });

      expect(res.status).toBe(403);
    });

    it('allows an admin to reach the users endpoint', async () => {
      const admin = await createAdmin();
      const token = await login(admin.email);

      const res = await request(app).get('/api/users').set(auth(token));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Password change', () => {
    it('changes the password and lets the user log in with the new one', async () => {
      const admin = await createAdmin({ email: 'pwd@test.local' });
      const token = await login(admin.email);

      const res = await request(app)
        .patch('/api/auth/change-password')
        .set(auth(token))
        .send({ currentPassword: PASSWORD, newPassword: 'BrandNew@2024' });

      expect(res.status).toBe(200);
      await expect(login('pwd@test.local', 'BrandNew@2024')).resolves.toEqual(expect.any(String));
    });

    it('rejects a wrong current password', async () => {
      const admin = await createAdmin();
      const token = await login(admin.email);

      const res = await request(app)
        .patch('/api/auth/change-password')
        .set(auth(token))
        .send({ currentPassword: 'Wrong@1234', newPassword: 'BrandNew@2024' });

      expect(res.status).toBe(400);
    });
  });
});
