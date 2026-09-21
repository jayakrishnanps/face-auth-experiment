import { Body, Controller, Get, Header, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Response } from 'express';
import { AppUser } from '../users/users.service';
import { AuthService } from './auth.service';
import { FaceLoginDto, RegisterDto } from './auth.dto';
import { AuthenticatedRequest, SESSION_COOKIE, SessionGuard } from './session.guard';
import { OriginGuard } from './origin.guard';

@Controller('auth')
@UseGuards(OriginGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
    };
  }
  private async session(user: AppUser, response: Response) {
    const token = await this.jwt.signAsync({ sub: user.id });
    response.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: this.config.getOrThrow<number>('SESSION_TTL_SECONDS') * 1000,
    });
    return { user };
  }
  @Post('register')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    return this.session(await this.auth.register(dto), response);
  }
  @Post('face-login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: FaceLoginDto, @Res({ passthrough: true }) response: Response) {
    return this.session(await this.auth.login(dto), response);
  }
  @Get('me')
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }

  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }
}
