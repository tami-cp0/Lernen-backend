import { BadRequestException, Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    /*
    Middleware level limiting because the web app
    only accepts document uploads to the chat
    */
    MulterModule.registerAsync({
      useFactory: () => ({
        storage: multer.diskStorage({}), 
        limits: {
          fileSize: 1024 * 1024 * 3, // 10mb,
          files: 3 // Maximum number of files
        },
        fileFilter: (req, file, callback) => {
          const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ];
          if (!allowedTypes.includes(file.mimetype)) {
            return callback(new BadRequestException('Only docx or pdf files are allowed!'), false);
          }
          callback(null, true);
        }
      }),
    })
  ],
  providers: [ChatService],
  controllers: [ChatController]
})
export class ChatModule {}
