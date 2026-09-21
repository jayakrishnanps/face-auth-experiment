import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';

describe('Real request rate limiter', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    setupApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('limits repeated authentication attempts without reaching the database', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(app.getHttpServer())
        .post('/auth/face-login')
        .set('Origin', 'http://localhost:5173')
        .send({})
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/auth/face-login')
      .set('Origin', 'http://localhost:5173')
      .send({})
      .expect(429);
  });
});
