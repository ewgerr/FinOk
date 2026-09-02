import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

process.env.NODE_ENV = 'test';
dotenv.config({ path: new URL('../.env', import.meta.url) });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const { app, prisma } = await import('../index.js');

const server = app.listen(0);
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const cleanup = async (email) => {
  await prisma.consultation.deleteMany({ where: { email } });
};

test.after(async () => {
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

test('health endpoint works', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.status, 'ok');
});

test('availability endpoint returns slots', async () => {
  const response = await fetch(`${baseUrl}/api/entities/Consultation/available-slots?date=2026-07-20&duration=15`);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.ok(Array.isArray(json.slots));
});

test('free consultation can be created', async () => {
  const email = `test-${Date.now()}@example.com`;
  const response = await fetch(`${baseUrl}/api/entities/Consultation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      phone: '+380501112233',
      firstName: 'Test',
      consultationType: 'FREE',
      preferredDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      consent: true,
    }),
  });

  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.consultationType, 'FREE');
  assert.equal(json.isPaid, false);
  await cleanup(email);
});
