import { ApiBearerAuth, ApiInternalServerErrorResponse, ApiTooManyRequestsResponse, ApiUnauthorizedResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { applyDecorators, INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication) {
  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API documentation for ')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        name: 'Authorization',
        scheme: 'bearer',
        in: 'header',
      },
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api/v1/docs', app, document);
}

export function ApiDefaultDocProtected() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Login required',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login required' },
          error: { type: 'string', example: 'Unauthorized' },
          statusCode: { type: 'number', example: 401 },
        },
      },
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          error: { type: 'string', example: 'Internal server error' },
          message: { type: 'string', example: 'Unexpected server error' },
        },
      },
    }),
  );
}

export function ApiDefaultDocPublic() {
  return applyDecorators(
    ApiInternalServerErrorResponse({
      description: 'Unexpected server error',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          error: { type: 'string', example: 'Internal server error' },
          message: { type: 'string', example: 'Unexpected server error' },
        },
      },
    })
    // rate limit not yet implemented
    // ApiTooManyRequestsResponse({
    //   description: 'Rate limit exceeded',
    //   schema: {
    //     type: 'object',
    //     properties: {
    //       statusCode: { type: 'number', example: 429 },
    //       ThrottlerException: { type: 'string', example: 'Too many requests' },
    //     },
    //   },
    // })
  );
}