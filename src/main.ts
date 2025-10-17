import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { AppConfigType } from './config/config.types';
import axios from 'axios';

config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);

  const corsOptions = {
    origin: [
      'http://localhost:3000', `${config.get<AppConfigType>('app')!.frontendUrl}`, 'http://127.0.0.1:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
    credentials: true,
  }

  app.enableCors(corsOptions);

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    dismissDefaultMessages: true,
    validationError: {
      target: true,
      value: true
    },
    stopAtFirstError: true,
    whitelist: true,
    forbidNonWhitelisted: true
  }));

  app.setGlobalPrefix('api/v1');

  setupSwagger(app);

  app.enableShutdownHooks();

  app.set('trust proxy', true);

  app.use(helmet());

  const port = config.get<AppConfigType>('app')!.port || 3000;
  await app.listen(port);

  Logger.log(`Application is running on: http://localhost:${port}/api/v1`);  
}
bootstrap();