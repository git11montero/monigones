import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseRpc } from '../server/online/transport';
import { OnlineHttpError } from '../server/online/http';
import { onlineHandler } from '../server/online/handler';
import { PostgresStore, type RpcTransport } from '../server/online/store';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const transport = () => new SupabaseRpc('https://fixture.invalid', 'sb_secret_fixture');
describe('Contrato HTTP de PostgREST', () => {
  it.each(['online_profile', 'online_tick_failed'])(
    'acepta 204 vacío de la RPC void %s',
    async (name) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
      await expect(transport().call(name)).resolves.toBeUndefined();
    },
  );
  it('acepta un cuerpo vacío 200 solo para una firma void conocida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('')),
    );
    await expect(transport().call('online_profile')).resolves.toBeUndefined();
    await expect(transport().call('online_load')).rejects.toMatchObject({
      status: 502,
      code: 'RPC_EMPTY_RESPONSE',
    });
  });
  it.each(['null', 'true', '{"membership":true}', '[]'])(
    'preserva el JSON legítimo %s',
    async (raw) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(raw)));
      expect(await transport().call('online_load')).toEqual(JSON.parse(raw));
    },
  );
  it.each(['', '{', '<html>unavailable</html>'])(
    'rechaza respuestas no válidas sin exponer sus cuerpos',
    async (raw) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(raw)));
      await expect(transport().call('online_load')).rejects.toMatchObject({ status: 502 });
    },
  );
  it('conserva el rechazo SQL y distingue errores de conexión y servidor', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Ya perteneces a una liga.' }), { status: 400 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError('network fixture'));
    vi.stubGlobal('fetch', fetch);
    await expect(transport().call('online_load')).rejects.toMatchObject({
      status: 400,
      message: 'Ya perteneces a una liga.',
    });
    await expect(transport().call('online_load')).rejects.toMatchObject({
      status: 502,
      code: 'RPC_REJECTED',
    });
    await expect(transport().call('online_load')).rejects.toMatchObject({
      status: 503,
      code: 'RPC_UNAVAILABLE',
    });
  });
});

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'fixture@example.test',
  name: 'Presidente 1',
};
function api() {
  const rpc: RpcTransport = {
    call: vi.fn(async <T>(name: string) => {
      if (name === 'online_profile') return undefined as T;
      if (name === 'online_rate') return true as T;
      if (name === 'online_load') return { membership: true } as T;
      throw new Error('fixture: unexpected RPC');
    }) as RpcTransport['call'],
  };
  const identity = vi.fn(async () => user);
  return {
    rpc,
    identity,
    handle: onlineHandler(
      new PostgresStore(rpc),
      {
        url: 'http://127.0.0.1',
        secret: 'fixture',
        cronSecret: 'x'.repeat(40),
        origin: 'https://monigones.vercel.app',
      },
      identity,
    ),
  };
}
describe('Cuerpos de entrada y sesión', () => {
  it('GET de sesión no lee el cuerpo, verifica Bearer y devuelve la membresía', async () => {
    const { handle, identity } = api();
    const req = new Request('https://monigones.vercel.app/api/session', {
      headers: { authorization: 'Bearer fixture-user' },
    });
    Object.defineProperty(req, 'text', {
      value: () => {
        throw new Error('GET must not read JSON');
      },
    });
    const result = await handle(req);
    expect(result.status).toBe(200);
    expect((await result.json()).membership).toBe(true);
    expect(identity).toHaveBeenCalledWith('fixture-user');
  });
  it.each([undefined, '', '   ', '{}', '{"accessToken":"ignored-legacy-body"}'])(
    'POST login admite cuerpo vacío u objeto válido',
    async (body) => {
      const { handle } = api();
      const response = await handle(
        new Request('https://monigones.vercel.app/api/login', {
          method: 'POST',
          headers: { authorization: 'Bearer fixture-user' },
          body,
        }),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).user.id).toBe(user.id);
    },
  );
  it.each(['{', '[]', 'null', 'false'])(
    'POST login rechaza JSON malformado o no objeto',
    async (body) => {
      const { handle, rpc } = api();
      const response = await handle(
        new Request('https://monigones.vercel.app/api/login', {
          method: 'POST',
          headers: { authorization: 'Bearer fixture-user' },
          body,
        }),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).code).toMatch(/INVALID_JSON|JSON_OBJECT_REQUIRED/);
      expect(rpc.call).not.toHaveBeenCalled();
    },
  );
  it.each(['/api/command', '/api/leagues'])(
    'la ruta %s exige un objeto JSON y responde 413 si es demasiado grande',
    async (path) => {
      const { handle } = api();
      const request = (body?: string) =>
        new Request('https://monigones.vercel.app' + path, {
          method: 'POST',
          headers: { authorization: 'Bearer fixture-user' },
          body,
        });
      expect((await handle(request())).status).toBe(400);
      expect((await handle(request('x'.repeat(512001)))).status).toBe(413);
    },
  );
  it('el token solo se toma del encabezado, nunca del JSON', async () => {
    const { handle, identity } = api();
    expect(
      (
        await handle(
          new Request('https://monigones.vercel.app/api/login', {
            method: 'POST',
            body: '{"accessToken":"body-only"}',
          }),
        )
      ).status,
    ).toBe(401);
    expect(identity).not.toHaveBeenCalled();
  });
  it('un fallo RPC no se convierte en JSON de cliente 400 ni invalida la identidad', async () => {
    const { handle, rpc } = api();
    vi.mocked(rpc.call).mockRejectedValueOnce(
      new OnlineHttpError(
        502,
        'RPC_INVALID_JSON',
        'Supabase devolvió una respuesta JSON inválida.',
        { rpc: 'online_profile', upstreamStatus: 200 },
      ),
    );
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await handle(
      new Request('https://monigones.vercel.app/api/session', {
        headers: { authorization: 'Bearer fixture-user' },
      }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe('RPC_INVALID_JSON');
    expect(JSON.stringify(logs.mock.calls)).not.toContain('fixture-user');
  });
  it('un error de programación es 500, no un rechazo de negocio', async () => {
    const { handle, rpc } = api();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(rpc.call).mockRejectedValueOnce(new TypeError('private internal fixture'));
    const response = await handle(
      new Request('https://monigones.vercel.app/api/session', {
        headers: { authorization: 'Bearer fixture-user' },
      }),
    );
    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain('private internal fixture');
  });
});
