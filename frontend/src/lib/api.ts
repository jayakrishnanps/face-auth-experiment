import { MODEL_VERSION } from '../face/quality';
export interface User {
  id: string;
  email: string;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)])
        : AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      'The server could not be reached. Check that the backend is running, then retry.',
      0,
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.message === 'string'
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join(' ')
          : response.status >= 500
            ? 'The server is not ready. Wait for the API to start, then retry.'
            : 'The request failed. Please retry.';
    throw new ApiError(
      response.status === 429 ? 'Too many attempts. Wait a minute before trying again.' : message,
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  ready: async (signal: AbortSignal) => {
    try {
      await request('/auth/me', { signal });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
  },
  register: (email: string, embeddings: number[][], signal: AbortSignal) =>
    request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, embeddings, modelVersion: MODEL_VERSION }),
      signal,
    }),
  login: (email: string, embedding: number[], signal: AbortSignal) =>
    request<{ user: User }>('/auth/face-login', {
      method: 'POST',
      body: JSON.stringify({ email, embedding, modelVersion: MODEL_VERSION }),
      signal,
    }),
  me: (signal?: AbortSignal) => request<{ user: User }>('/auth/me', { signal }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};
