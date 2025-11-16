import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RedisService } from './redis.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '24h', // Token expires in 24 hours
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    RedisService,
    JwtStrategy,
    JwtAuthGuard,  // Provide guards for manual use
    RolesGuard,
  ],
  exports: [JwtModule, PassportModule, JwtAuthGuard, RolesGuard, RedisService],
})
export class AuthModule {}

