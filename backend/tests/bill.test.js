'use strict';

const {
  app,
  request,
  resetDb,
  createAdmin,
  createReceptionist,
  createPatient,
  login,
  auth,
} = require('./helpers');

describe('Billing', () => {
  let adminToken;
  let receptionistToken;
  let patient;
  let patientToken;

  beforeEach(async () => {
    await resetDb();

    const admin = await createAdmin({ email: 'admin.bill@test.local' });
    adminToken = await login(admin.email);

    const receptionist = await createReceptionist({ email: 'recep.bill@test.local' });
    receptionistToken = await login(receptionist.email);

    const pat = await createPatient({ email: 'bill.patient@test.local' });
    patient = pat.patient;
    patientToken = await login(pat.user.email);
  });

  const charges = {
    consultationCharges: 800,
    medicineCharges: 1250.5,
    testCharges: 2400,
    roomCharges: 0,
    otherCharges: 150,
  };
  const EXPECTED_TOTAL = 4600.5;

  it('creates a bill and calculates the total automatically', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set(auth(receptionistToken))
      .send({ patientId: patient.id, ...charges });

    expect(res.status).toBe(201);
    expect(res.body.data.billCode).toMatch(/^BILL-\d{6}$/);
    expect(res.body.data.totalAmount).toBe(EXPECTED_TOTAL);
    expect(res.body.data.paymentStatus).toBe('Pending');
    expect(res.body.data.balanceDue).toBe(EXPECTED_TOTAL);
  });

  it('ignores a client-supplied total and recomputes it', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set(auth(receptionistToken))
      .send({ patientId: patient.id, ...charges, totalAmount: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(EXPECTED_TOTAL);
  });

  it('treats missing charge fields as zero', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set(auth(receptionistToken))
      .send({ patientId: patient.id, consultationCharges: 500 });

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(500);
    expect(res.body.data.medicineCharges).toBe(0);
  });

  it('rejects negative charges', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set(auth(receptionistToken))
      .send({ patientId: patient.id, consultationCharges: -100 });

    expect(res.status).toBe(422);
  });

  it('rejects a bill for an unknown patient', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set(auth(receptionistToken))
      .send({ patientId: 999999, consultationCharges: 100 });

    expect(res.status).toBe(404);
  });

  describe('payment status', () => {
    let billId;

    beforeEach(async () => {
      const created = await request(app)
        .post('/api/bills')
        .set(auth(receptionistToken))
        .send({ patientId: patient.id, ...charges });
      billId = created.body.data.id;
    });

    it('moves to Partially Paid after a part payment', async () => {
      const res = await request(app)
        .patch(`/api/bills/${billId}/pay`)
        .set(auth(receptionistToken))
        .send({ amount: 1000, paymentMethod: 'UPI' });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentStatus).toBe('Partially Paid');
      expect(res.body.data.amountPaid).toBe(1000);
      expect(res.body.data.balanceDue).toBe(3600.5);
    });

    it('moves to Paid once the balance is settled', async () => {
      await request(app)
        .patch(`/api/bills/${billId}/pay`)
        .set(auth(receptionistToken))
        .send({ amount: 1000 });

      const res = await request(app)
        .patch(`/api/bills/${billId}/pay`)
        .set(auth(receptionistToken))
        .send({ amount: 3600.5 });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentStatus).toBe('Paid');
      expect(res.body.data.balanceDue).toBe(0);
      expect(res.body.data.paymentDate).not.toBeNull();
    });

    it('rejects a payment larger than the balance', async () => {
      const res = await request(app)
        .patch(`/api/bills/${billId}/pay`)
        .set(auth(receptionistToken))
        .send({ amount: 99999 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds the outstanding balance/i);
    });

    it('rejects a zero or negative payment', async () => {
      const res = await request(app)
        .patch(`/api/bills/${billId}/pay`)
        .set(auth(receptionistToken))
        .send({ amount: 0 });

      expect(res.status).toBe(422);
    });

    it('recalculates the total when charges are edited', async () => {
      const res = await request(app)
        .put(`/api/bills/${billId}`)
        .set(auth(receptionistToken))
        .send({ testCharges: 0, otherCharges: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.totalAmount).toBe(2050.5);
    });

    it('settles the balance when marked Paid', async () => {
      const res = await request(app)
        .put(`/api/bills/${billId}`)
        .set(auth(receptionistToken))
        .send({ paymentStatus: 'Paid' });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentStatus).toBe('Paid');
      expect(res.body.data.amountPaid).toBe(EXPECTED_TOTAL);
    });
  });

  describe('authorization', () => {
    it('lets a patient see their own bills only', async () => {
      await request(app)
        .post('/api/bills')
        .set(auth(receptionistToken))
        .send({ patientId: patient.id, consultationCharges: 700 });

      const other = await createPatient({ email: 'bill.other@test.local' });
      await request(app)
        .post('/api/bills')
        .set(auth(receptionistToken))
        .send({ patientId: other.patient.id, consultationCharges: 900 });

      const res = await request(app).get('/api/bills').set(auth(patientToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientId).toBe(patient.id);
    });

    it('stops a patient from creating a bill', async () => {
      const res = await request(app)
        .post('/api/bills')
        .set(auth(patientToken))
        .send({ patientId: patient.id, consultationCharges: 1 });

      expect(res.status).toBe(403);
    });

    it('stops a patient from recording a payment', async () => {
      const created = await request(app)
        .post('/api/bills')
        .set(auth(receptionistToken))
        .send({ patientId: patient.id, consultationCharges: 500 });

      const res = await request(app)
        .patch(`/api/bills/${created.body.data.id}/pay`)
        .set(auth(patientToken))
        .send({ amount: 500 });

      expect(res.status).toBe(403);
    });

    it('lets an admin filter bills by payment status', async () => {
      await request(app)
        .post('/api/bills')
        .set(auth(receptionistToken))
        .send({ patientId: patient.id, consultationCharges: 500 });
      await request(app)
        .post('/api/bills')
        .set(auth(receptionistToken))
        .send({ patientId: patient.id, consultationCharges: 500, amountPaid: 500 });

      const res = await request(app)
        .get('/api/bills?paymentStatus=Paid')
        .set(auth(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].paymentStatus).toBe('Paid');
    });
  });
});
