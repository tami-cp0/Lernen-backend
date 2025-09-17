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

  // add queing and multi template support later
  async sendEmail(
    emailType: 'sign_in',
    to: string,
    variables: { tempToken?: string; id?: string }
  ) {
    let subject = '';
    let html = '';

    const url = new URL(
      this.configService.get<AppConfigType>('app')?.onboardingUrl ?? ''
    );
    url.search = new URLSearchParams({
      token: variables.tempToken ?? '',
      id: variables.id ?? '',
      provider: 'email',
    }).toString();

    const replaced = MagicLinkEmailTemplate.html.replace('{{link}}', url.toString());

    switch (emailType) {
      case 'sign_in':
        subject = MagicLinkEmailTemplate.subject;
        html = replaced;
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
