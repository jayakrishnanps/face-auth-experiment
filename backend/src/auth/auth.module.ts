import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { FaceModule } from '../face/face.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { OriginGuard } from './origin.guard';

@Module({
  imports: [
    UsersModule,
    FaceModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow<number>('SESSION_TTL_SECONDS'),
          issuer: 'face-auth-api',
          audience: 'face-auth-web',
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: 'face-auth-api',
          audience: 'face-auth-web',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, OriginGuard],
  exports: [SessionGuard, JwtModule, UsersModule],
})
export class AuthModule {}
