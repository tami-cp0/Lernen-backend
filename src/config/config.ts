import { registerAs } from '@nestjs/config';
import { Environment } from './config.types';

export const AppConfig = registerAs(
    'app',
    () => ({
        env: process.env.NODE_ENV?.toLowerCase() as Environment || Environment.Local,
        name: process.env.APP_NAME,
        port: Number(process.env.APP_PORT || '3000'),
        frontendUrl: process.env.FRONTEND_URL,
        backendUrl: process.env.BACKEND_URL,
        onboardingUrl: process.env.ONBOARDING_URL
    })
);

export const DatabaseConfig = registerAs(
    'database',
    () => ({ url: process.env.DATABASE_URL })
);

export const JwtConfig = registerAs(
    'jwt',
    () => ({
        secret: process.env.JWT_SECRET,
        expiration: process.env.JWT_EXPIRATION
    })
)

export const RefreshJwtConfig = registerAs(
    'refreshJwt',
    () => ({
        secret: process.env.REFRESH_JWT_SECRET,
        expiration: process.env.REFRESH_JWT_EXPIRATION
    })
)

export const ForgotPasswordJwtConfig = registerAs(
    'forgotPasswordJwt',
    () => ({
        secret: process.env.FORGOT_PASSWORD_JWT_SECRET,
        expiration: process.env.FORGOT_PASSWORD_JWT_EXPIRATION,
        redirectUrl: process.env.FORGOT_PASSWORD_FRONTEND_REDIRECT_URL
    })
)

export const GmailConfig = registerAs(
    'gmail',
    () => ({ 
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    })
)

export const OpenAIConfig = registerAs(
    'openai',
    () => ({ 
        key: process.env.OPENAI_API_KEY,
        vectorStoreId: process.env.OPENAI_API_VECTOR_STORE_ID,
    })
)

export const GoogleConfig = registerAs(
    'google',
    () => ({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUrl: process.env.GOOGLE_REDIRECT_URL,
    })
)

export const ChromaConfig = registerAs(
    'chroma',
    () => ({
        apiKey: process.env.CHROMA_API_KEY,
        tenant: process.env.CHROMA_TENANT,
        database: process.env.CHROMA_DATABASE,
    })
)

export const s3Config = registerAs(
    's3',
    () => ({
        endpoint: process.env.TEBI_S3_ENDPOINT,
        accessKeyId: process.env.TEBI_ACCESS_KEY,
        secretAccessKey: process.env.TEBI_SECRET_KEY,
    })
)

export const redisConfig = registerAs(
    'redis',
    () => ({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
    })
)

export const configurations = [
    AppConfig,  
    DatabaseConfig,
    JwtConfig,
    GmailConfig,
    OpenAIConfig,
    RefreshJwtConfig,
    ForgotPasswordJwtConfig,
    GoogleConfig,
    ChromaConfig,
    s3Config,
    redisConfig,
];
