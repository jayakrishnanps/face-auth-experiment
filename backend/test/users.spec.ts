import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { UsersService } from '../src/users/users.service';
import { MODEL_VERSION } from '../src/face/face.constants';

describe('Database boundary', () => {
  it('performs enrollment with one atomic RPC and maps unique conflicts', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
    const rpc = jest.fn().mockReturnValue({ single });
    const service = new UsersService({ rpc } as unknown as SupabaseClient);
    await expect(service.register('a@example.com', [[1], [2], [3]])).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('register_face_user', {
      p_email: 'a@example.com',
      p_embeddings: [[1], [2], [3]],
      p_model_version: MODEL_VERSION,
    });
  });
  it('sanitizes database errors instead of returning internals', async () => {
    const service = new UsersService({
      rpc: () => ({
        single: async () => ({
          data: null,
          error: { code: 'PGRST202', message: 'private details' },
        }),
      }),
    } as unknown as SupabaseClient);
    await expect(service.register('a@example.com', [])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('escapes wildcard email characters and does not expose templates', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: 'id', email: 'a_b%test@example.com' }, error: null });
    const ilike = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ ilike });
    const from = jest.fn().mockReturnValue({ select });
    const service = new UsersService({ from } as unknown as SupabaseClient);
    await service.findByEmail('a_b%test@example.com');
    expect(select).toHaveBeenCalledWith('id,email');
    expect(ilike).toHaveBeenCalledWith('email', 'a\\_b\\%test@example.com');
  });
});
