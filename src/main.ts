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

	app.use(helmet());

	const frontendUrl = config.get<AppConfigType>('app')!.frontendUrl!;
	const backendUrl = config.get<AppConfigType>('app')!.backendUrl!;

	const allowedOrigins = [
		'http://localhost:3000', 
		'http://127.0.0.1:3000',
	];

	// Add production URLs if they exist
	if (frontendUrl) {
		allowedOrigins.push(frontendUrl);
		// Also allow without trailing slash if present
		allowedOrigins.push(frontendUrl.replace(/\/$/, ''));
	}
	if (backendUrl) {
		allowedOrigins.push(backendUrl);
		// Also allow without trailing slash if present
		allowedOrigins.push(backendUrl.replace(/\/$/, ''));
	}

	const corsOptions = {
		origin: allowedOrigins,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
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
