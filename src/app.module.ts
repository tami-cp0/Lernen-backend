import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/allException.filter';
import { configurations } from './config/config';
import { validateConfig } from './config/config.validation';
import { AuthService } from './core/auth/auth.service';
import { AuthModule } from './core/auth/auth.module';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from './common/services/email/email.module';
import { ChatModule } from './core/chat/chat.module';
import { UserModule } from './core/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      ignoreEnvFile: false,
      load: [...configurations],
      validate: validateConfig,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: Number(config.get<string>('REDIS_PORT')),
          password: config.get<string>('REDIS_PASSWORD'),
          username: config.get<string>('REDIS_USERNAME'),
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuthModule,
    EmailModule,
    ChatModule,
    UserModule
  ],
  providers: [
    {
      provide: 'APP_FILTER',
      useClass: AllExceptionsFilter
    },
  ],
})
export class AppModule {}
