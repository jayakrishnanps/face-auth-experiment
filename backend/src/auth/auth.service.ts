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
        `Face verification: accountFound=${Boolean(user)} templates=${templates.length} similarity=${score.toFixed(2)} threshold=${threshold.toFixed(2)}`,
      );
    }
    if (!user || templates.length !== 3 || score < threshold) {
      throw new UnauthorizedException(
        'Could not sign in. Use the same email and face you registered with. If you have not created an account, choose Register.',
      );
    }
    return user;
  }
}
