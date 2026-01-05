import { ConfigType } from "@nestjs/config";
import { AppConfig, ChromaConfig, DatabaseConfig, ForgotPasswordJwtConfig, GmailConfig, GoogleConfig, JwtConfig, OpenAIConfig, RefreshJwtConfig, s3Config } from "./config";
import { Config } from "drizzle-kit";

export enum Environment {
    Local = 'local',
    Development = 'development',
    Production = 'production',
    Test = 'test',
}

export type AppConfigType = ConfigType<typeof AppConfig>

export type DatabaseConfigType = ConfigType<typeof DatabaseConfig>;

export type JwtConfigType = ConfigType<typeof JwtConfig>;

export type RefreshJwtConfigType = ConfigType<typeof RefreshJwtConfig>;

export type ForgotPasswordJwtConfigType = ConfigType<typeof ForgotPasswordJwtConfig>;

export type GmailConfigType = ConfigType<typeof GmailConfig>

export type OpenAIConfigType = ConfigType<typeof OpenAIConfig>;

export type GoogleConfigType = ConfigType<typeof GoogleConfig>;

export type ChromaConfigType = ConfigType<typeof ChromaConfig>;

export type s3ConfigType = ConfigType<typeof s3Config>;