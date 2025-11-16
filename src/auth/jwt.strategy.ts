import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { Request } from 'express';

export interface JwtPayload {
  userId: String,
  userName: String,
  iap: number,
  iat: number,
  exp: number,
  role: String,
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true, // Enable to get request object
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    console.log("payload: ", payload);
    if (!payload.userId || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Extract full JWT token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token is in blacklist
    const isBlacklisted = await this.redisService.checkJwtInBlacklist(
      payload.userId.toString(),
      token,
    );

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Return user info to be attached to request
    return {
      userId: payload.userId,
      role: payload.role,
    };
  }
}

