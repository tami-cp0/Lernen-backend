import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DatabaseModule } from 'src/database/database.module';
import { EmailModule } from 'src/common/services/email/email.module';

@Module({
    imports: [DatabaseModule, EmailModule],
    providers: [UserService],
    controllers: [UserController]
})
export class UserModule {}
