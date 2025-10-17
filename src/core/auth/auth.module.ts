import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtConfigType } from 'src/config/config.types';
import { AuthController } from './auth.controller';
import { EmailModule } from 'src/common/services/email/email.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
    imports: [
        DatabaseModule,
        PassportModule,
        EmailModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<JwtConfigType>('jwt')!.secret!,
                signOptions: {
                    expiresIn: Number(config.get<JwtConfigType>('jwt')!.expiration!)
                }
            })
        })
    ],
    providers: [AuthService, JwtStrategy],
    controllers: [AuthController]
})
export class AuthModule {}
