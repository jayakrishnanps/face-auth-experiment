import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const base = 'http://127.0.0.1:3000';
const email = `face-smoke-${randomUUID()}@example.com`;
const rollbackEmail = `face-rollback-${randomUUID()}@example.com`;
const sample = Array.from({ length: 1024 }, (_, i) => Math.sin(i) * 0.2);
const version = '3.3.6/faceres';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
});
let cookie = '';
let createdId;
async function call(path, body) {
  const response = await fetch(`${base}/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.FRONTEND_ORIGIN,
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return response;
}

try {
  assert.equal((await call('me')).status, 401);
  const registered = await call('register', {
    email: email.toUpperCase(),
    embeddings: [sample, sample, sample],
    modelVersion: version,
  });
  assert.equal(registered.status, 201);
  assert.match(registered.headers.get('set-cookie'), /HttpOnly/);
  const registeredBody = await registered.json();
  createdId = registeredBody.user.id;
  assert.equal(registeredBody.user.email, email);
  assert.deepEqual(Object.keys(registeredBody), ['user']);
  const templates = await db
    .from('face_templates')
    .select('sample_number,model_name,model_version')
    .eq('user_id', createdId)
    .order('sample_number');
  assert.equal(templates.error, null);
  assert.deepEqual(
    templates.data.map((row) => row.sample_number),
    [1, 2, 3],
  );
  assert.ok(
    templates.data.every(
      (row) => row.model_name === 'human-faceres' && row.model_version === version,
    ),
  );
  console.log('PASS: atomic registration, normalized email, three templates, HTTP-only session');

  assert.equal((await call('me')).status, 200);
  assert.equal(
    (await call('register', { email, embeddings: [sample, sample, sample], modelVersion: version }))
      .status,
    409,
  );
  assert.equal((await call('logout', {})).status, 204);
  assert.equal((await call('me')).status, 401);
  console.log('PASS: protected /me, duplicate email, logout clears session');

  assert.equal(
    (await call('face-login', { email, embedding: Array(1024).fill(5), modelVersion: version }))
      .status,
    401,
  );
  assert.equal((await call('me')).status, 401);
  assert.equal(
    (await call('face-login', { email, embedding: sample, modelVersion: version })).status,
    200,
  );
  assert.equal((await call('me')).status, 200);
  await call('logout', {});
  console.log('PASS: non-matching vector denied; matching vector creates a fresh session');

  // Force a failure on the third sample, after the function has attempted earlier writes.
  const rollback = await db.rpc('register_face_user', {
    p_email: rollbackEmail,
    p_embeddings: [sample, sample, [1, 2]],
    p_model_version: version,
  });
  assert.equal(rollback.error?.code, '22023');
  const remaining = await db.from('app_users').select('id').eq('email', rollbackEmail);
  assert.equal(remaining.error, null);
  assert.deepEqual(remaining.data, []);
  console.log('PASS: bad third sample rolls back the user and earlier templates');
} finally {
  // Delete only this run's uniquely named synthetic account; cascade removes its samples.
  const cleanup = await db.from('app_users').delete().in('email', [email, rollbackEmail]);
  assert.equal(cleanup.error, null, 'Could not clean up temporary test accounts');
  if (createdId) {
    const leftovers = await db.from('face_templates').select('id').eq('user_id', createdId);
    assert.equal(leftovers.error, null);
    assert.deepEqual(leftovers.data, []);
  }
  console.log('Temporary database test data removed.');
}
