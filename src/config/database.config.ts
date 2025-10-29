import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  // Check if DATABASE_URL is provided (connection string format)
  const databaseUrl = configService.get<string>('DATABASE_URL');

  if (databaseUrl) {
    // Parse connection string
    // Format: postgres://user:password@host:port/database
    const url = new URL(databaseUrl);

    return {
      type: 'postgres',
      host: url.hostname,
      port: parseInt(url.port),
      username: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: configService.get<string>('NODE_ENV') === 'development',
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      migrationsRun: false,
    };
  }

  // Fallback to individual environment variables
  return {
    type: 'postgres',
    host: configService.get<string>('DATABASE_HOST'),
    port: configService.get<number>('DATABASE_PORT'),
    username: configService.get<string>('DATABASE_USER'),
    password: configService.get<string>('DATABASE_PASSWORD'),
    database: configService.get<string>('DATABASE_NAME'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: configService.get<string>('NODE_ENV') === 'development',
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: false,
  };
};

