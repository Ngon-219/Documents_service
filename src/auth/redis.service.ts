import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// JWT expiration time in seconds (should match Rust service JWT_EXPIRED_TIME)
const JWT_EXPIRED_TIME = 86400; // 24 hours in seconds

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (redisUrl) {
      this.client = new Redis(redisUrl);
    } else {
      this.client = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
      });
    }

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected successfully');
    });

    this.client.on('error', (error) => {
      this.logger.error('❌ Redis connection error', error);
    });
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  /**
   * Check if JWT token is in blacklist
   * Key format: jwt:blacklist:{user_id}:{jwt}
   */
  async checkJwtInBlacklist(userId: string, jwt: string): Promise<boolean> {
    try {
      const key = `jwt:blacklist:${userId}:${jwt}`;
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check JWT blacklist for user ${userId}`, error);
      // If Redis fails, allow the request (fail open for availability)
      // You can change this to fail closed if needed
      return false;
    }
  }

  /**
   * Add JWT token to blacklist
   * Key format: jwt:blacklist:{user_id}:{jwt}
   * TTL: JWT_EXPIRED_TIME (should match Rust service)
   */
  async addJwtToBlacklist(userId: string, jwt: string, ttl?: number): Promise<void> {
    try {
      const key = `jwt:blacklist:${userId}:${jwt}`;
      const now = Math.floor(Date.now() / 1000);
      const expirationTime = ttl || JWT_EXPIRED_TIME;
      await this.client.setex(key, expirationTime, now.toString());
      this.logger.log(`JWT added to blacklist for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to add JWT to blacklist for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get Redis client (for advanced usage)
   */
  getClient(): Redis {
    return this.client;
  }
}

