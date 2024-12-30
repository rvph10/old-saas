import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as expressSession from 'express-session';
import * as cookieParser from 'cookie-parser';
import { CustomLoggerService } from '@infrastructure/logger/logger.service';
import { MetricsService } from '@infrastructure/monitoring/metrics.service';
import { GlobalExceptionFilter } from '@core/filters/global-exception.filter';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

declare module 'express-session' {
  interface SessionData {
    touch: () => void;
    [key: string]: any;
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLoggerService(),
  });

  app.enableCors({
    origin: 'http://192.168.129.100:3000',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Access-Control-Allow-Credentials',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Origin',
      'X-CSRF-Token',
      'session-id',
      'Cookie',
    ],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.use(cookieParser(process.env.COOKIE_SECRET));

  const metricsService = app.get(MetricsService);
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379',
    legacyMode: false,
  });

  await redisClient.connect().catch((err) => {
    logger.error('Redis connection error:', err);
    throw err;
  });

  app.use(
    expressSession({
      store: new RedisStore({
        client: redisClient,
        prefix: 'session:',
        ttl: 86400,
        disableTouch: false,
      }),
      secret: process.env.COOKIE_SECRET || 'your-secret-key',
      resave: true,
      saveUninitialized: true,
      rolling: true,
      name: 'session_id',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: '/',
      },
    }),
  );

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
  redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
}
bootstrap();
