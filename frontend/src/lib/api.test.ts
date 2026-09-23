import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('API readiness before face capture', () => {
  it('allows a signed-out user when the API responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
        ),
    );
    await expect(api.ready(new AbortController().signal)).resolves.toBeUndefined();
  });
  it('reports a starting API rather than a face or lighting problem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(api.ready(new AbortController().signal)).rejects.toThrow(/server is not ready/);
  });
  it('reports a network failure without proceeding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.ready(new AbortController().signal)).rejects.toThrow(
      /server could not be reached/,
    );
  });
});
