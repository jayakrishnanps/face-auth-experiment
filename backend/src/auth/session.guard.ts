import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppUser, UsersService } from '../users/users.service';

export const SESSION_COOKIE = 'face_session';
export type AuthenticatedRequest = Request & { user: AppUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') throw new UnauthorizedException('Please sign in.');
    let subject: string;
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string }>(token);
      if (
        typeof claims.sub !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.sub)
      )
        throw new Error('Invalid subject');
      subject = claims.sub;
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    const user = await this.users.findById(subject);
    if (!user) throw new UnauthorizedException('Please sign in.');
    request.user = user;
    return true;
  }
}
