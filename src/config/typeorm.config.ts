import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

// Function to get database config from environment
function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Parse connection string
    const url = new URL(databaseUrl);
    return {
      type: 'postgres' as const,
      host: url.hostname,
      port: parseInt(url.port),
      username: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
    };
  }

  // Fallback to individual environment variables
  return {
    type: 'postgres' as const,
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  };
}

export default new DataSource({
  ...getDatabaseConfig(),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
});

