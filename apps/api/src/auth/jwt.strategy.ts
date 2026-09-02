import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Custom extractor that reads the JWT from the httpOnly 'token' cookie.
 * Falls back to the Authorization: Bearer header for flexibility (e.g. Postman testing).
 */
function cookieOrBearerExtractor(req: Request): string | null {
  // Try cookie first
  if (req?.cookies?.qatrack_token) {
    return req.cookies.qatrack_token;
  }
  // Fallback to Authorization header
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-me',
    });
  }

  async validate(payload: any) {
    // This payload will be attached to the request object as req.user.
    // Both `id` and `sub` mirror the JWT's `sub` claim so callers can read
    // either req.user.id or req.user.sub.
    return {
      id: payload.sub,
      sub: payload.sub,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      avatarUrl: payload.avatarUrl,
    };
  }
}
