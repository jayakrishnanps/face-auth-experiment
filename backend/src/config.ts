export function validateEnvironment(env: Record<string, unknown>) {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'JWT_SECRET']) {
    if (typeof env[name] !== 'string' || !(env[name] as string).trim())
      throw new Error(`${name} is required in backend/.env`);
  }
  if ((env.JWT_SECRET as string).length < 32)
    throw new Error('JWT_SECRET must have at least 32 characters');
  const url = new URL(env.SUPABASE_URL as string);
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS');
  const origin = String(env.FRONTEND_ORIGIN ?? 'http://localhost:5173');
  if (new URL(origin).origin !== origin)
    throw new Error('FRONTEND_ORIGIN must be one origin, without a trailing slash');
  const number = (name: string, fallback: number, min: number, max: number, integer = false) => {
    const value = Number(env[name] ?? fallback);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw new Error(`${name} is invalid`);
    return value;
  };
  const mode = String(env.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(mode)) throw new Error('Invalid NODE_ENV');
  if (mode === 'production' && !origin.startsWith('https://'))
    throw new Error('Production FRONTEND_ORIGIN must use HTTPS');
  if (
    env.FACE_DEBUG_SCORES !== undefined &&
    !['true', 'false'].includes(String(env.FACE_DEBUG_SCORES))
  )
    throw new Error('FACE_DEBUG_SCORES must be true or false');
  return {
    ...env,
    NODE_ENV: mode,
    FRONTEND_ORIGIN: origin,
    PORT: number('PORT', 3000, 1, 65535, true),
    SESSION_TTL_SECONDS: number('SESSION_TTL_SECONDS', 3600, 60, 86400, true),
    FACE_MATCH_THRESHOLD: number('FACE_MATCH_THRESHOLD', 0.5, 0.01, 1),
    FACE_DEBUG_SCORES: String(env.FACE_DEBUG_SCORES ?? 'false') === 'true',
  };
}
