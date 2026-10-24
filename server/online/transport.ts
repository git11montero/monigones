import type { RpcTransport } from './store.js';
import { OnlineHttpError } from './http.js';
// These SQL signatures are RETURNS void. Empty responses are valid only here.
const voidFunctions = new Set(['online_profile', 'online_tick_failed']);
/** PostgREST transport: no TCP pool, SQLite, disk writes or permanent Node process. */
export class SupabaseRpc implements RpcTransport {
  constructor(
    readonly url: string,
    readonly secret: string,
  ) {}
  async call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: this.secret,
          ...(this.secret.startsWith('sb_secret_')
            ? {}
            : { Authorization: `Bearer ${this.secret}` }),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new OnlineHttpError(503, 'RPC_UNAVAILABLE', 'No se pudo conectar con Supabase.', {
        rpc: name,
      });
    }
    let raw: string;
    try {
      raw = await response.text();
    } catch {
      throw new OnlineHttpError(
        502,
        'RPC_RESPONSE_INTERRUPTED',
        'La respuesta de Supabase se interrumpió.',
        { rpc: name, upstreamStatus: response.status },
      );
    }
    const diagnostic = { rpc: name, upstreamStatus: response.status };
    if (response.ok && !raw.trim()) {
      if (voidFunctions.has(name)) return undefined as T;
      throw new OnlineHttpError(
        502,
        'RPC_EMPTY_RESPONSE',
        'Supabase devolvió una respuesta vacía inesperada.',
        diagnostic,
      );
    }
    let data: any;
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new OnlineHttpError(
          502,
          'RPC_INVALID_JSON',
          'Supabase devolvió una respuesta JSON inválida.',
          diagnostic,
        );
      }
    }
    if (!response.ok) {
      const status =
        response.status === 429
          ? 503
          : response.status === 400 || response.status === 409 || response.status === 422
            ? 400
            : 502;
      const message =
        status === 400 && typeof data?.message === 'string'
          ? data.message
          : `No se pudo completar la operación en Supabase (HTTP ${response.status}).`;
      throw new OnlineHttpError(status, 'RPC_REJECTED', message, diagnostic);
    }
    return data as T;
  }
}
