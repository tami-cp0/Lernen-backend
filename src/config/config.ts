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

export const configurations = [
    AppConfig,  
    DatabaseConfig,
    JwtConfig,
    GmailConfig,
    OpenAIConfig
];
