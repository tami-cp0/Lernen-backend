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
    emailType: 'magic_link',
    to: string,
    variables: { authToken?: string },
  ) {
    let subject = '';
    let html = '';

    switch (emailType) {
      case 'magic_link':
        subject = MagicLinkEmailTemplate.subject;
        html = MagicLinkEmailTemplate.html
          .replace('{{link}}', `${this.configService.get<AppConfigType>('app')?.onboardingUrl}?token=${variables.authToken ?? ''}`);
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
