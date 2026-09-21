import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), { bodyParser: false });
  setupApp(app);
  app.enableShutdownHooks();
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  // Bind locally; an HTTPS reverse proxy can expose the API for a later deployment.
  await app.listen(port, '127.0.0.1');
  console.log(`Face authentication API: http://localhost:${port}`);
}
void bootstrap();
