import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
