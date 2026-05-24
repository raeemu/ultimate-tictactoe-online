import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { join } from 'node:path';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const frontendRoot = join(process.cwd(), '..', 'frontend', 'dist');
  app.useStaticAssets(frontendRoot);

  const express = app.getHttpAdapter().getInstance();
  express.get('/', (_req: Request, res: Response) => {
    res.redirect('/auth');
  });
  express.get(['/auth', '/register', '/lobby', '/profile', '/game/:matchId'], (_req: Request, res: Response) => {
    res.sendFile(join(frontendRoot, 'index.html'));
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
