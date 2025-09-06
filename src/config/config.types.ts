import { ConfigType } from "@nestjs/config";
import { AppConfig, DatabaseConfig, GmailConfig, JwtConfig, OpenAIConfig, RefreshJwtConfig } from "./config";
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

export type RefreshConfigType = ConfigType<typeof RefreshJwtConfig>;

export type GmailConfigType = ConfigType<typeof GmailConfig>

export type OpenAIConfigType = ConfigType<typeof OpenAIConfig>;