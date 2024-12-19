import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomLoggerService } from './common/monitoring/logger.service';
import { MetricsService } from './common/monitoring/metrics.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLoggerService(),
  });

  const metricsService = app.get(MetricsService);

  // Updated CORS configuration to handle multiple origins
  const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: [
      'Origin', 
      'X-Requested-With', 
      'Content-Type', 
      'Accept', 
      'Authorization', 
      'session-id'
    ],
    exposedHeaders: ['session-id']
  });

  app.useGlobalFilters(new GlobalExceptionFilter(metricsService));
  app.useLogger(new CustomLoggerService());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  const port = process.env.PORT || 5000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  logger.log(`Application is running on: http://${host}:${port}`);
}
bootstrap();