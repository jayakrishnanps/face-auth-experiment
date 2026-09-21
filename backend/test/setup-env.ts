// Isolated test settings: no real Supabase credentials or local .env required.
Object.assign(process.env, {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'test-only-secret',
  JWT_SECRET: 'test-only-jwt-secret-with-at-least-32-characters',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  SESSION_TTL_SECONDS: '3600',
  FACE_MATCH_THRESHOLD: '0.5',
  FACE_DEBUG_SCORES: 'false',
});
