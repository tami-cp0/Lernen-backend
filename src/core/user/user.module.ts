import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DatabaseModule } from 'src/database/database.module';
import { EmailModule } from 'src/common/services/email/email.module';
import { CacheModule } from 'src/common/services/cache/cache.module';

@Module({
	imports: [DatabaseModule, EmailModule, CacheModule],
	providers: [UserService],
	controllers: [UserController],
})
export class UserModule {}
