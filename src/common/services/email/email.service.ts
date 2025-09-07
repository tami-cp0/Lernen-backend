import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordJwtConfigType, GmailConfigType } from 'src/config/config.types';
import RegisterEmailTemplate from './templates/otpVerification';
import PasswordResetEmailTemplate from './templates/passwordReset';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<GmailConfigType>('gmail')!.user,
        pass: this.configService.get<GmailConfigType>('gmail')!.pass,
      },
    });
  }

  // add queing support later
  async sendEmail(
    emailType: 'email_verification' | 'password_reset',
    to: string,
    variables: { name?: string; otp?: string; resetToken?: string },
  ) {
    let subject = '';
    let html = '';

    switch (emailType) {
      case 'email_verification':
        subject = RegisterEmailTemplate.subject;
        html = RegisterEmailTemplate.html
          .replace('{{name}}', variables.name ?? '')
          .replace('{{otp}}', variables.otp ?? '');
        break;

      case 'password_reset':
        subject = PasswordResetEmailTemplate.subject;
        html = PasswordResetEmailTemplate.html
          .replace('{{name}}', variables.name ?? '')
          .replace('{{link}}', `${this.configService.get<ForgotPasswordJwtConfigType>('forgotPasswordJwt')!.redirectUrl}?token=${variables.resetToken ?? ''}`);
        break;

      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }

    await this.transporter.sendMail({
      from: `"Noto" <${this.configService.get<GmailConfigType>('gmail')!.user}>`,
      to,
      subject,
      html,
    });
  }
}
