import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { AppConfigType, GmailConfigType } from 'src/config/config.types';
import MagicLinkEmailTemplate from './templates/magicLink';

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
    emailType: 'sign_in',
    to: string,
    variables: { tempToken?: string }
  ) {
    let subject = '';
    let html = '';

    switch (emailType) {
      case 'sign_in':
        subject = MagicLinkEmailTemplate.subject;
        html = MagicLinkEmailTemplate.html
          .replace('{{link}}', `${this.configService.get<AppConfigType>('app')?.onboardingUrl}?token=${variables.tempToken ?? ''}&email=${to}`);
        break;

      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }

    await this.transporter.sendMail({
      from: `"Lernen" <${this.configService.get<GmailConfigType>('gmail')!.user}>`,
      to,
      subject,
      html,
    });
  }
}
