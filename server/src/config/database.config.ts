import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Configuration object for TypeORM database connection.
 * 
 * @type {TypeOrmModuleOptions}
 * @property {string} type - The type of database. In this case, 'postgres'.
 * @property {string} host - The database host, defaulting to 'localhost' if not provided in environment variables.
 * @property {number} port - The port number for the database connection, defaulting to 5432 if not provided in environment variables.
 * @property {string} username - The username for the database connection, defaulting to 'postgres' if not provided in environment variables.
 * @property {string} password - The password for the database connection, defaulting to 'postgres' if not provided in environment variables.
 * @property {string} database - The name of the database, defaulting to 'nibblix' if not provided in environment variables.
 * @property {string[]} entities - The paths to the entity files.
 * @property {boolean} synchronize - Indicates if the database schema should be auto-synced, enabled if not in production.
 * @property {boolean} logging - Indicates if logging should be enabled, enabled if not in production.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'nibblix',
  entities: ['dist/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
};