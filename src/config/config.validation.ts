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

  @IsString({ message: 'ONBOARDING_URL must be a string' })
  @IsNotEmpty({ message: 'ONBOARDING_URL is required and cannot be empty' })
  ONBOARDING_URL: string;

  // GOOGLE
  @IsString({ message: 'GOOGLE_REDIRECT_URL must be a string' })
  @IsNotEmpty({ message: 'GOOGLE_REDIRECT_URL is required and cannot be empty' })
  GOOGLE_REDIRECT_URL: string;

  @IsString({ message: 'GOOGLE_CLIENT_ID must be a string' })
  @IsNotEmpty({ message: 'GOOGLE_CLIENT_ID is required and cannot be empty' })
  GOOGLE_CLIENT_ID: string;

  @IsString({ message: 'GOOGLE_CLIENT_SECRET must be a string' })
  @IsNotEmpty({ message: 'GOOGLE_CLIENT_SECRET is required and cannot be empty' })
  GOOGLE_CLIENT_SECRET: string;

  // DB
  @IsString({ message: 'DATABASE_URL must be a string' })
  @IsNotEmpty({ message: 'DATABASE_URL is required and cannot be empty' })
  DATABASE_URL: string;

  // FORGOT PASSWORD JWT
  @IsString({ message: 'FORGOT_PASSWORD_JWT_SECRET must be a string' })
  @IsNotEmpty({ message: 'FORGOT_PASSWORD_JWT_SECRET is required and cannot be empty' })
  FORGOT_PASSWORD_JWT_SECRET: string;

  @IsNumberString({}, { message: 'FORGOT_PASSWORD_JWT_EXPIRATION must be a numeric string' })
  @IsNotEmpty({ message: 'FORGOT_PASSWORD_JWT_EXPIRATION is required and cannot be empty' })
  FORGOT_PASSWORD_JWT_EXPIRATION: number;

  @IsString({ message: 'FORGOT_PASSWORD_FRONTEND_REDIRECT_URL must be a string' })
  @IsNotEmpty({ message: 'FORGOT_PASSWORD_FRONTEND_REDIRECT_URL is required and cannot be empty' })
  FORGOT_PASSWORD_FRONTEND_REDIRECT_URL: string;

  // @IsString({ message: 'FRONTEND_URL must be a string' })
  // @IsNotEmpty({ message: 'FRONTEND_URL is required and cannot be empty' })
  // FRONTEND_URL: string;

  // @IsString({ message: 'BACKEND_URL must be a string' })
  // @IsNotEmpty({ message: 'BACKEND_URL is required and cannot be empty' })
  // BACKEND_URL: string;

  // JWT
  @IsNumberString({}, { message: 'REFRESH_JWT_EXPIRATION must be a numeric string'})
  @IsNotEmpty({ message: 'REFRESH_JWT_EXPIRATION is required and cannot be empty'})
  REFRESH_JWT_EXPIRATION: number;

  @IsString({ message: 'REFRESH_JWT_SECRET must be a string'})
  @IsNotEmpty({ message: 'REFRESH_JWT_SECRET is required and cannot be empty'})
  REFRESH_JWT_SECRET: string;

  @IsNumberString({}, { message: 'JWT_EXPIRATION must be a numeric string'})
  @IsNotEmpty({ message: 'JWT_EXPIRATION is required and cannot be empty'})
  JWT_EXPIRATION: number

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
  
  // CHROMA
  @IsString({ message: 'CHROMA_API_KEY must be a string' })
  @IsNotEmpty({ message: 'CHROMA_API_KEY is required and cannot be empty' })
  CHROMA_API_KEY: string;

  @IsString({ message: 'CHROMA_TENANT must be a string' })
  @IsNotEmpty({ message: 'CHROMA_TENANT is required and cannot be empty' })
  CHROMA_TENANT: string;

  @IsString({ message: 'CHROMA_DATABASE must be a string' })
  @IsNotEmpty({ message: 'CHROMA_DATABASE is required and cannot be empty' })
  CHROMA_DATABASE: string;

  // S3
  @IsString({ message: 'TEBI_S3_ENDPOINT must be a string' })
  @IsNotEmpty({ message: 'TEBI_S3_ENDPOINT is required and cannot be empty' })
  TEBI_S3_ENDPOINT: string;

  @IsString({ message: 'TEBI_ACCESS_KEY must be a string' })
  @IsNotEmpty({ message: 'TEBI_ACCESS_KEY is required and cannot be empty' })
  TEBI_ACCESS_KEY: string;

  @IsString({ message: 'TEBI_SECRET_KEY must be a string' })
  @IsNotEmpty({ message: 'TEBI_SECRET_KEY is required and cannot be empty' })
  TEBI_SECRET_KEY: string;

  // Redis
  @IsString({ message: 'UPSTASH_REDIS_URL must be a string' })
  @IsNotEmpty({ message: 'UPSTASH_REDIS_URL is required and cannot be empty' })
  UPSTASH_REDIS_URL: string;

  @IsString({ message: 'UPSTASH_REDIS_TOKEN must be a string' })
  @IsNotEmpty({ message: 'UPSTASH_REDIS_TOKEN is required and cannot be empty' })
  UPSTASH_REDIS_TOKEN: string;
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