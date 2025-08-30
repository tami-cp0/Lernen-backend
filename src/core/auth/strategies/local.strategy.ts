import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginBodyDTO } from '../dto/login.dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' }); // use 'email' instead of default 'username'
  }

  async validate(email: string, password: string) {
    // Manual validation
    const dto = plainToInstance(LoginBodyDTO, { email, password });
    const errors = validateSync(dto);

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return user; // will be attached to req.user
  }
}
