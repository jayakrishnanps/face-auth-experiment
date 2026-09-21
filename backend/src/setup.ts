import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json } from 'express';

export function setupApp(app: INestApplication) {
  app.use(helmet());
  app.use(json({ limit: '256kb' }));
  app.use(cookieParser());
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string>('FRONTEND_ORIGIN'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
}
