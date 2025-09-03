import { IsEmail, IsEnum, IsNotEmpty, IsNumberString, IsString, Min, MinLength, validateSync } from "class-validator";
import { Environment } from "./config.types";
import { plainToClass, plainToInstance } from "class-transformer";

class EnvironmentVariables {
  // APP
  @IsEnum(Environment, {
    message: 'NODE_ENV must be one of: local, development, production, test',
  })
  @IsNotEmpty({ message: 'NODE_ENV is required and cannot be empty' })
  NODE_ENV: Environment;

  @IsString({ message: 'APP_NAME must be a string' })
  @IsNotEmpty({ message: 'APP_NAME is required and cannot be empty' })
  APP_NAME: string;

  @IsNumberString({}, { message: 'APP_PORT must be a numeric string' })
  @IsNotEmpty({ message: 'APP_PORT is required and cannot be empty' })
  APP_PORT: string;

  // DB
  @IsString({ message: 'DATABASE_URL must be a string' })
  @IsNotEmpty({ message: 'DATABASE_URL is required and cannot be empty' })
  DATABASE_URL: string;

  // @IsString({ message: 'FRONTEND_URL must be a string' })
  // @IsNotEmpty({ message: 'FRONTEND_URL is required and cannot be empty' })
  // FRONTEND_URL: string;

  // @IsString({ message: 'BACKEND_URL must be a string' })
  // @IsNotEmpty({ message: 'BACKEND_URL is required and cannot be empty' })
  // BACKEND_URL: string;

  // JWT
  @IsString({ message: 'JWT_REFRESH_EXPIRATION must be a string'})
  @IsNotEmpty({ message: 'JWT_REFRESH_EXPIRATION is required and cannot be empty'})
  JWT_REFRESH_EXPIRATION: string

  @IsString({ message: 'JWT_ACCESS_EXPIRATION must be a string'})
  @IsNotEmpty({ message: 'JWT_ACCESS_EXPIRATION is required and cannot be empty'})
  JWT_ACCESS_EXPIRATION: string

  @IsString({ message: 'JWT_SECRET must be a string'})
  @IsNotEmpty({ message: 'JWT_SECRET is required and cannot be empty'})
  JWT_SECRET: string;

  // GMAIL
  @IsEmail({}, { message: 'GMAIL_USER must be a valid email address' })
  @IsNotEmpty({ message: 'GMAIL_USER is required and cannot be empty' })
  GMAIL_USER: string;

  @IsString({ message: 'GMAIL_PASS must be a string' })
  @IsNotEmpty({ message: 'GMAIL_PASS is required and cannot be empty' })
  GMAIL_PASS: string;

  // OPENAI
  @IsString({ message: 'OPENAI_API_KEY must be a string' })
  @IsNotEmpty({ message: 'OPENAI_API_KEY is required and cannot be empty' })
  OPENAI_API_KEY: string;

  @IsString({ message: 'OPENAI_API_VECTOR_STORE_ID must be a string' })
  @IsNotEmpty({ message: 'OPENAI_API_VECTOR_STORE_ID is required and cannot be empty' })
  OPENAI_API_VECTOR_STORE_ID: string;
}


export function validateConfig(configuration: Record<string, unknown>) {
  const finalConfig = plainToInstance(EnvironmentVariables, configuration);

  const errors = validateSync(finalConfig);

  if (errors.length) {
    const formatted = errors
      .flatMap(err => Object.values(err.constraints || {}))
      .join('\n');

    throw new Error(`Config validation failed:\n${formatted}`);
  }

  return finalConfig;
}