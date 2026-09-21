import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE } from '../database/database.module';
import { MODEL_NAME, MODEL_VERSION } from '../face/face.constants';
import { isEmbedding } from '../face/embedding.validator';

export interface AppUser {
  id: string;
  email: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(@Inject(DATABASE) private readonly db: SupabaseClient) {}

  private fail(code: string | undefined): never {
    // Do not log response bodies, email addresses, credentials, or templates.
    this.logger.error(`Database request failed (${code ?? 'unknown'})`);
    throw new ServiceUnavailableException(
      'The account service is unavailable. Please try again shortly.',
    );
  }

  async register(email: string, embeddings: number[][]): Promise<AppUser> {
    const { data, error } = await this.db
      .rpc('register_face_user', {
        p_email: email,
        p_embeddings: embeddings,
        p_model_version: MODEL_VERSION,
      })
      .single<AppUser>();
    if (error?.code === '23505')
      throw new ConflictException('This email is already registered. Please sign in.');
    if (error || !data) this.fail(error?.code);
    return { id: data.id, email: data.email };
  }

  async findByEmail(email: string): Promise<AppUser | null> {
    // Escape LIKE metacharacters so email lookup is exact, including older mixed-case rows.
    const exactEmail = email.replace(/[\\%_]/g, (value) => `\\${value}`);
    const { data, error } = await this.db
      .from('app_users')
      .select('id,email')
      .ilike('email', exactEmail)
      .maybeSingle<AppUser>();
    if (error) this.fail(error.code);
    return data;
  }

  async findById(id: string): Promise<AppUser | null> {
    const { data, error } = await this.db
      .from('app_users')
      .select('id,email')
      .eq('id', id)
      .maybeSingle<AppUser>();
    if (error) this.fail(error.code);
    return data;
  }

  async templates(userId: string): Promise<number[][]> {
    const { data, error } = await this.db
      .from('face_templates')
      .select('embedding')
      .eq('user_id', userId)
      .eq('model_name', MODEL_NAME)
      .eq('model_version', MODEL_VERSION)
      .order('sample_number')
      .limit(3);
    if (error) this.fail(error.code);
    const vectors: number[][] = [];
    for (const row of data ?? []) {
      try {
        const vector: unknown =
          typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
        if (isEmbedding(vector)) vectors.push(vector);
      } catch {
        /* Corrupt stored templates never grant access. */
      }
    }
    return vectors;
  }
}
