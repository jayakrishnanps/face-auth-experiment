import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FaceService } from '../face/face.service';
import { UsersService } from '../users/users.service';
import { FaceLoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly users: UsersService,
    private readonly face: FaceService,
    private readonly config: ConfigService,
  ) {}
  register(dto: RegisterDto) {
    return this.users.register(dto.email, dto.embeddings);
  }
  async login(dto: FaceLoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const templates = user ? await this.users.templates(user.id) : [];
    const score = this.face.bestSimilarity(dto.embedding, templates);
    const threshold = this.config.getOrThrow<number>('FACE_MATCH_THRESHOLD');
    if (this.config.get<boolean>('FACE_DEBUG_SCORES')) {
      this.logger.log(
        `Face verification: similarity=${score.toFixed(2)} threshold=${threshold.toFixed(2)}`,
      );
    }
    if (!user || templates.length !== 3 || score < threshold) {
      throw new UnauthorizedException(
        'Face verification failed. Check your email, lighting, and camera position.',
      );
    }
    return user;
  }
}
