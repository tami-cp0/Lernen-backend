import { Controller, Get } from '@nestjs/common';

@Controller('app')
export class AppController {
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}