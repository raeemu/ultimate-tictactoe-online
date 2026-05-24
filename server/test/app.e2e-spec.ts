import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/register (POST)', () => {
    const userId = Date.now();

    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: `e2e_user_${userId}`,
        email: `e2e_user_${userId}@example.com`,
        password: 'password123',
      })
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });
});
