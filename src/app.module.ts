import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/allException.filter';
import { configurations } from './config/config';
import { validateConfig } from './config/config.validation';
import { AuthService } from './core/auth/auth.service';
import { AuthModule } from './core/auth/auth.module';
import { EmailModule } from './common/services/email/email.module';
import { ChatModule } from './core/chat/chat.module';
import { UserModule } from './core/user/user.module';
import { AppController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      ignoreEnvFile: false,
      load: [...configurations],
      validate: validateConfig,
    }),
    DatabaseModule,
    AuthModule,
    EmailModule,
    ChatModule,
    UserModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 10,
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: 'APP_FILTER',
      useClass: AllExceptionsFilter
    },
  ],
})
export class AppModule {}
