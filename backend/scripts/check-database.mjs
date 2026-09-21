import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
});
let failed = false;
for (const table of ['app_users', 'face_templates']) {
  const { error } = await db.from(table).select('id', { head: true, count: 'exact' });
  console.log(`${table}: ${error ? `FAILED (${error.code ?? 'network error'})` : 'accessible'}`);
  if (error) failed = true;
}
// Invalid input deliberately checks the RPC without ever inserting a user.
const { error } = await db.rpc('register_face_user', {
  p_email: '',
  p_embeddings: [],
  p_model_version: '3.3.6/faceres',
});
const available = error?.code === '22023';
console.log(
  `Atomic registration function: ${available ? 'available' : `NOT READY (${error?.code ?? 'unexpected result'}). Run backend/sql/001_atomic_registration.sql in Supabase SQL Editor.`}`,
);
process.exitCode = failed || !available ? 1 : 0;
