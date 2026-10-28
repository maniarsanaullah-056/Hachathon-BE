import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../models/User.js';

const qaUri = process.env.TEST_MONGODB_URI;
let request;
let app;

function assertQaDatabase(uri) {
  const databaseName = new URL(uri).pathname.replace(/^\//, '');
  if (!/(^|[_-])(qa|test)([_-]|$)/i.test(databaseName)) {
    throw new Error('TEST_MONGODB_URI must use a database name containing qa or test');
  }
}

before(async () => {
  if (!qaUri) return;
  assertQaDatabase(qaUri);
  process.env.MONGODB_URI = qaUri;
  process.env.JWT_SECRET ||= 'qa-only-secret-at-least-32-characters-long';
  await mongoose.connect(qaUri);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  ({ default: app } = await import('../app.js'));
  ({ default: request } = await import('supertest'));
});

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('F01/F02 fresh setup, duplicate setup, login, and password response safety', { skip: !qaUri }, async () => {
  const status = await request(app).get('/api/setup/status').expect(200);
  assert.equal(status.body.data.isSetupComplete, false);

  const setup = await request(app).post('/api/setup/init').send({
    companyName: 'QA Company',
    adminName: 'QA Admin',
    adminEmail: 'admin.qa@example.test',
    adminPassword: 'AdminPass123',
  }).expect(201);
  assert.equal(Object.hasOwn(setup.body.data.user, 'password'), false);

  const storedAdmin = await User.findOne({ email: 'admin.qa@example.test' }).select('+password');
  assert.ok(/^\$2[aby]\$/.test(storedAdmin.password));
  assert.notEqual(storedAdmin.password, 'AdminPass123');

  await request(app).post('/api/setup/init').send({
    companyName: 'QA Company',
    adminName: 'QA Admin',
    adminEmail: 'admin.qa@example.test',
    adminPassword: 'AdminPass123',
  }).expect(409);

  await request(app).post('/api/admins').send({
    companyName: 'Another Company',
    adminName: 'Another Admin',
    adminEmail: 'other.qa@example.test',
    adminPassword: 'OtherPass123',
  }).expect(409);

  await request(app).post('/api/auth/login').send({
    email: 'admin.qa@example.test', password: 'WrongPass123',
  }).expect(401);

  const login = await request(app).post('/api/auth/login').send({
    email: 'admin.qa@example.test', password: 'AdminPass123',
  }).expect(200);
  assert.ok(login.body.data.token);
  assert.equal(login.body.data.user.role, 'admin');
  assert.equal(Object.hasOwn(login.body.data.user, 'password'), false);

  await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token').expect(401);
  await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${login.body.data.token}`).expect(200);
});
