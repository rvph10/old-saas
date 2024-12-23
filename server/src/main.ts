import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomLoggerService } from './common/monitoring/logger.service';
import { MetricsService } from './common/monitoring/metrics.service';
import { RedisService } from './redis/redis.service';
import * as expressSession from 'express-session';
import { Store } from 'express-session';

// Create a custom session store that uses our RedisService
class CustomRedisStore extends Store {
  constructor(private redisService: RedisService) {
    super();
  }

  async get(sid: string, callback: (err: any, session?: any) => void) {
    try {
      const data = await this.redisService.get(`session:${sid}`);
      callback(null, data ? JSON.parse(data) : null);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: any, callback?: (err?: any) => void) {
    try {
      // Convert max age to seconds for Redis TTL
      const ttl = session.cookie.maxAge
        ? Math.floor(session.cookie.maxAge / 1000)
        : 86400;
      await this.redisService.set(
        `session:${sid}`,
        JSON.stringify(session),
        ttl,
      );
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await this.redisService.del(`session:${sid}`);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLoggerService(),
  });

  const metricsService = app.get(MetricsService);
  const redisService = app.get(RedisService);

  logger.debug('FRONTEND_URL:', process.env.FRONTEND_URL);
  logger.debug('NODE_ENV:', process.env.NODE_ENV);

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
  });

  app.use(
    (
      req: { method: string },
      res: {
        header: (arg0: string, arg1: string) => void;
        status: (arg0: number) => {
          (): any;
          new (): any;
          json: { (arg0: {}): any; new (): any };
        };
      },
      next: () => any,
    ) => {
      if (req.method === 'OPTIONS') {
        res.header(
          'Access-Control-Allow-Methods',
          'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        );
        res.header(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Authorization, session-id',
        );
        res.header('Access-Control-Allow-Credentials', 'true');
        return res.status(200).json({});
      }
      return next();
    },
  );

  app.useGlobalFilters(new GlobalExceptionFilter(metricsService));
  app.useLogger(new CustomLoggerService());

  // Use our custom Redis store
  app.use(
    expressSession({
      // Changed this line
      store: new CustomRedisStore(redisService),
      secret: process.env.COOKIE_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      },
    }),
  );

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
