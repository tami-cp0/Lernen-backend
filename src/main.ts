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

	app.set('trust proxy', true);

	app.use(
		helmet({
			crossOriginResourcePolicy: { policy: 'cross-origin' },
		})
	);

	const frontendUrl = config.get<AppConfigType>('app')!.frontendUrl!;

	const corsOptions = {
		origin: [
			'http://localhost:3000',
			'http://127.0.0.1:3000',
			frontendUrl,
		],
		credentials: true,
	};

	app.enableCors(corsOptions);

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			transformOptions: { enableImplicitConversion: true },
			dismissDefaultMessages: true,
			validationError: {
				target: true,
				value: true,
			},
			stopAtFirstError: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		})
	);

	app.setGlobalPrefix('api/v1');

	setupSwagger(app);

	app.enableShutdownHooks();

	// Simple request logger middleware
	app.use((req, res, next) => {
		const timestamp = new Date().toISOString();
		Logger.log(`[${timestamp}] ${req.method} ${req.url}`, 'HTTP');
		next();
	});

	const port = config.get<AppConfigType>('app')!.port || 3000;
	await app.listen(port);

	Logger.log(`Application is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
