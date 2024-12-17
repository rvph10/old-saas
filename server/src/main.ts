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

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://client:3000',
      process.env.CORS_ORIGIN
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'session-id'],
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
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
