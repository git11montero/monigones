// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({
  isOnlineBackend: true,
  onlineScope: 'fixture-scope',
  getSupabase: () => ({ auth }),
}));
import { request, ApiError } from '../src/lib/api';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('envía sesión GET y login POST vacío con Bearer, sin repetir token ni contraseña en el cuerpo', async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'fixture-header-only', user: { id: 'fixture-user' } } },
  });
  const fetch = vi.fn(async () => new Response('{"user":{"id":"fixture-user"}}'));
  vi.stubGlobal('fetch', fetch);
  await request('/api/session');
  await request('/api/login', { method: 'POST' });
  for (const call of fetch.mock.calls as unknown as [string, RequestInit][]) {
    expect(new Headers(call[1].headers).get('authorization')).toBe('Bearer fixture-header-only');
    expect(new Headers(call[1].headers).has('content-type')).toBe(false);
    expect(call[1].body).toBeUndefined();
  }
});
it.each(['', '<html>gateway error</html>'])(
  'un error HTTP vacío o no JSON conserva el estado y tiene mensaje explícito',
  async (body) => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 503 })),
    );
    const failure = await request('/api/session').catch((e) => e);
    expect(failure).toBeInstanceOf(ApiError);
    if (!(failure instanceof ApiError)) throw new Error('Expected ApiError');
    expect(failure.status).toBe(503);
    expect(failure.message).not.toContain('Unexpected end');
  },
);
