import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtConfigType } from 'src/config/config.types';
import { JwtPayload } from '../auth.types';
import { DatabaseService } from 'src/database/database.service';
import { eq } from 'drizzle-orm';
import { users } from 'src/database/schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: configService.get<JwtConfigType>('jwt')!.secret!
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
        throw new UnauthorizedException('Sign in required');
    }

    const user = await this.databaseService.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      with: {
        authAccounts: true
      }
    });
    if (!user) throw new UnauthorizedException('Sign in required');

    if (payload.provider === 'email') {
      const emailAccount = user.authAccounts.find((account) => account.provider === 'email')

      if (emailAccount && !emailAccount.active) {
        throw new UnauthorizedException('Sign in required');
      }

      if (!emailAccount) throw new InternalServerErrorException('No email auth account')
    } else if (payload.provider === 'google') {
      const googleAccount = user.authAccounts.find((account) => account.provider === 'google')

      if (googleAccount && !googleAccount.active) {
        throw new UnauthorizedException('Sign in required');
      }

      if (!googleAccount) throw new InternalServerErrorException('No google auth account')
    }

    return user; // will be attached to req.user
  }
}
