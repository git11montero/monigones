import type { IncomingMessage, ServerResponse } from 'node:http';
import { productionHandler } from '../server/online/handler.js';
import { writeOnlineResponse } from '../server/online/response.js';
/** One stateless Vercel Function. Never imports server/index.ts or node:sqlite. */
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      if (req.body !== undefined)
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      else {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          const b = Buffer.from(chunk);
          size += b.length;
          if (size > 512000) throw Error('Petición demasiado grande.');
          chunks.push(b);
        }
        body = Buffer.concat(chunks).toString('utf8');
      }
    }
    const request = new Request(`https://${req.headers.host || 'monigones.vercel.app'}${req.url}`, {
      method: req.method,
      headers,
      body,
    });
    const response = await productionHandler()(request);
    await writeOnlineResponse(response, res, req.headers['accept-encoding']);
  } catch {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify({ error: 'El backend online no está configurado o no está disponible.' }),
    );
  }
}
