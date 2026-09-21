import 'reflect-metadata';
import { INestApplication, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { setupApp } from '../src/setup';
import { MODEL_VERSION } from '../src/face/face.constants';

const origin = 'http://localhost:5173';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.com' };
const sample = Array.from({ length: 1024 }, (_, i) => Math.sin(i) * 0.2);
const users = {
  register: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  templates: jest.fn(),
};

describe('Authentication HTTP contract', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersService)
      .useValue(users)
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    setupApp(app);
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    users.register.mockResolvedValue(user);
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    users.templates.mockResolvedValue([sample, sample, sample]);
  });
  afterAll(async () => {
    await app?.close();
  });
  const registerBody = () => ({
    email: '  TEST@example.com ',
    embeddings: [sample, sample, sample],
    modelVersion: MODEL_VERSION,
  });
  const loginBody = () => ({ email: user.email, embedding: sample, modelVersion: MODEL_VERSION });

  it('normalizes email, enrolls three templates, sets an HTTP-only cookie, and returns only user details', async () => {
    const client = request.agent(app.getHttpServer());
    const result = await client
      .post('/auth/register')
      .set('Origin', origin)
      .send(registerBody())
      .expect(201);
    expect(users.register).toHaveBeenCalledWith(user.email, [sample, sample, sample]);
    expect(result.body).toEqual({ user });
    expect(result.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(result.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect(result.headers['cache-control']).toBe('no-store');
    await client.get('/auth/me').expect(200, { user });
    const logout = await client.post('/auth/logout').set('Origin', origin).expect(204);
    expect(logout.headers['set-cookie'][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
    await client.get('/auth/me').expect(401);
  });

  it('matches only the claimed account and grants a session on a match', async () => {
    const client = request.agent(app.getHttpServer());
    await client
      .post('/auth/face-login')
      .set('Origin', origin)
      .send(loginBody())
      .expect(200, { user });
    expect(users.findByEmail).toHaveBeenCalledWith(user.email);
    expect(users.templates).toHaveBeenCalledWith(user.id);
    await client.get('/auth/me').expect(200);
  });

  it('denies a different face without setting a cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/face-login')
      .set('Origin', origin)
      .send({ ...loginBody(), embedding: Array(1024).fill(5) })
      .expect(401);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('denies missing users and incomplete templates', async () => {
    users.findByEmail.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .post('/auth/face-login')
      .set('Origin', origin)
      .send(loginBody())
      .expect(401);
    expect(users.templates).not.toHaveBeenCalled();
    users.templates.mockResolvedValueOnce([sample]);
    await request(app.getHttpServer())
      .post('/auth/face-login')
      .set('Origin', origin)
      .send(loginBody())
      .expect(401);
  });

  it('returns 409 for duplicate registration', async () => {
    users.register.mockRejectedValueOnce(new ConflictException('Already registered'));
    const result = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', origin)
      .send(registerBody())
      .expect(409);
    expect(result.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    { email: 'not-an-email' },
    { embeddings: [sample] },
    { embeddings: [sample, sample, Array(1024).fill(0)] },
    { embeddings: [sample, sample, Array(1024).fill('1')] },
    { embeddings: [sample, sample, [1, 2]] },
    { embeddings: [sample, sample, Array(1024).fill(null)] },
    { modelVersion: 'wrong-model' },
    { admin: true },
  ])('rejects malformed enrollment before database access (case %#)', async (override) => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', origin)
      .send({ ...registerBody(), ...override })
      .expect(400);
    expect(users.register).not.toHaveBeenCalled();
  });

  it('blocks cross-origin and missing-origin mutations', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'https://other.example')
      .send(registerBody())
      .expect(403);
    await request(app.getHttpServer()).post('/auth/logout').expect(403);
    expect(users.register).not.toHaveBeenCalled();
  });

  it('rejects missing, tampered, expired, and deleted-user sessions', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', 'face_session=invalid.jwt.signature')
      .expect(401);
    const expired = await app.get(JwtService).signAsync({ sub: user.id }, { expiresIn: -1 });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `face_session=${expired}`)
      .expect(401);
    const valid = await app.get(JwtService).signAsync({ sub: user.id });
    users.findById.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `face_session=${valid}`)
      .expect(401);
  });
});
