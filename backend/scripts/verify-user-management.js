// Temporary, uniquely named records only. Run from backend after Prisma migrations.
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

const suffix = crypto.randomBytes(5).toString('hex');
const companyId = crypto.randomUUID();
const otherCompanyId = crypto.randomUUID();
const adminId = crypto.randomUUID();
const managerEmail = `manager-${suffix}@example.invalid`;
let managerId;
let server;

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

try {
  await prisma.company.create({ data: { id: companyId, name: `Users test ${suffix}` } });
  await prisma.company.create({ data: { id: otherCompanyId, name: `Other users test ${suffix}` } });
  await prisma.user.create({ data: { id: adminId, companyId, name: 'Test admin', email: `admin-${suffix}@example.invalid`, passwordHash: await bcrypt.hash('AdminTest@123', 12), role: 'COMPANY_ADMIN' } });
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const login = await api('/auth/login', { method: 'POST', body: { email: `admin-${suffix}@example.invalid`, password: 'AdminTest@123' } });
  assert.equal(login.status, 200);
  const adminToken = login.body.accessToken;
  assert.equal((await api('/users', { token: adminToken })).status, 200);
  assert.equal((await api('/users/managers', { token: adminToken, method: 'POST', body: { name: 'Cross company', email: `cross-${suffix}@example.invalid`, password: 'ManagerTest@123', companyId: otherCompanyId } })).status, 403);
  const created = await api('/users/managers', { token: adminToken, method: 'POST', body: { name: 'Test manager', email: managerEmail, password: 'ManagerTest@123', companyId } });
  assert.equal(created.status, 201);
  managerId = created.body.id;
  const managerLogin = await api('/auth/login', { method: 'POST', body: { email: managerEmail, password: 'ManagerTest@123' } });
  assert.equal(managerLogin.status, 200);
  const managerToken = managerLogin.body.accessToken;
  assert.equal((await api('/machines', { token: managerToken })).status, 200);
  assert.equal((await api('/users', { token: managerToken })).status, 200);
  assert.equal((await api('/companies', { token: managerToken })).status, 200);
  assert.equal((await api('/commands/machines/not-a-uuid', { token: managerToken, method: 'POST', body: { type: 'BEEP' } })).status, 403);
  assert.equal((await api('/users/managers', { token: managerToken, method: 'POST', body: { name: 'No', email: `no-${suffix}@example.invalid`, password: 'ManagerTest@123', companyId } })).status, 403);
  assert.equal((await api(`/companies/${companyId}/branding`, { token: managerToken, method: 'PATCH', body: { accentColor: '#69B7FF' } })).status, 403);
  const tinyImage = 'data:image/png;base64,iVBORw0KGgo=';
  const brand = await api(`/companies/${companyId}/branding`, { token: adminToken, method: 'PATCH', body: { accentColor: '#69B7FF', logoData: tinyImage } });
  assert.equal(brand.status, 200);
  assert.equal(brand.body.accentColor, '#69B7FF');
  assert.equal(brand.body.logoData, tinyImage);
  assert.equal((await api(`/companies/${otherCompanyId}/branding`, { token: adminToken, method: 'PATCH', body: { accentColor: '#69B7FF' } })).status, 403);
  assert.equal((await api('/auth/me', { token: managerToken, method: 'PATCH', body: { avatarData: tinyImage } })).body.avatarData, tinyImage);
  assert.equal((await api(`/users/${managerId}`, { token: adminToken, method: 'PATCH', body: { active: false } })).status, 200);
  assert.equal((await api('/auth/me', { token: managerToken })).status, 401);
  assert.equal((await api(`/users/${managerId}`, { token: adminToken, method: 'PATCH', body: { active: true } })).status, 200);
  assert.equal((await api('/auth/me', { token: managerToken })).status, 401);
  assert.equal((await api(`/users/${managerId}/reset-password`, { token: adminToken, method: 'POST', body: { password: '1' } })).status, 204);
  assert.equal((await api('/auth/me', { token: managerToken })).status, 401);
  const relogin = await api('/auth/login', { method: 'POST', body: { email: managerEmail, password: '1' } });
  assert.equal(relogin.status, 200);
  const updated = await api('/auth/me', { token: relogin.body.accessToken, method: 'PATCH', body: { name: 'Updated manager' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, 'Updated manager');
  assert.equal((await api('/auth/change-password', { method: 'POST', body: { newPassword: '2' } })).status, 401);
  assert.equal((await api('/auth/change-password', { token: relogin.body.accessToken, method: 'POST', body: { newPassword: '' } })).status, 400);
  assert.equal((await api('/auth/change-password', { token: relogin.body.accessToken, method: 'POST', body: { newPassword: '2' } })).status, 204);
  assert.equal((await api('/auth/me', { token: relogin.body.accessToken })).status, 401);
  assert.equal((await api('/auth/refresh', { method: 'POST', body: { refreshToken: relogin.body.refreshToken } })).status, 401);
  assert.equal((await api('/auth/login', { method: 'POST', body: { email: managerEmail, password: '1' } })).status, 401);
  const shortLogin = await api('/auth/login', { method: 'POST', body: { email: managerEmail, password: '2' } });
  assert.equal(shortLogin.status, 200);
  // Reusing the same password is allowed and still revokes previous sessions.
  assert.equal((await api('/auth/change-password', { token: shortLogin.body.accessToken, method: 'POST', body: { newPassword: '2' } })).status, 204);
  assert.equal((await api('/auth/me', { token: shortLogin.body.accessToken })).status, 401);
  console.log('User management, manager isolation, branding, and password invalidation: OK');
} catch (error) {
  console.error('User management verification failed:', error.message);
  throw error;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$transaction(async tx => {
    const userIds = [adminId, managerId].filter(Boolean);
    await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  }, { timeout: 30000 });
  await prisma.$disconnect();
}
