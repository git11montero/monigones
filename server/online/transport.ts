import type { RpcTransport } from './store';
/** PostgREST transport: no TCP pool, SQLite, disk writes or permanent Node process. */
export class SupabaseRpc implements RpcTransport {
  constructor(
    readonly url: string,
    readonly secret: string,
  ) {}
  async call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: this.secret,
        ...(this.secret.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.secret}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.message || 'No se pudo completar la transacción PostgreSQL.');
    return data as T;
  }
}
