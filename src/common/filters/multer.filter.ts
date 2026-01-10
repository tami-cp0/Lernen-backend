import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
	catch(exception: MulterError, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const res = ctx.getResponse<Response>();

		// Set CORS headers manually since exception bypasses normal flow
		const origin = ctx.getRequest().headers.origin;
		if (origin) {
			res.setHeader('Access-Control-Allow-Origin', origin);
			res.setHeader('Access-Control-Allow-Credentials', 'true');
		}

		if (exception.code === 'LIMIT_FILE_SIZE') {
			res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
				statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
				message: 'File too large! Max size is 10MB.',
				error: 'Payload Too Large',
			});
		} else {
			res.status(HttpStatus.BAD_REQUEST).json({
				statusCode: HttpStatus.BAD_REQUEST,
				message: exception.message,
				error: 'Bad Request',
			});
		}
	}
}
