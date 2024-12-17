import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');

      // Test the connection by running a simple query
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connection verified');
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }
}
