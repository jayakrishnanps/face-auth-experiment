import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export const DATABASE = Symbol('DATABASE');

@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SECRET_KEY'),
          {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: {
              fetch: (input, init) =>
                fetch(input, { ...init, signal: AbortSignal.timeout(12_000) }),
            },
          },
        ),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
