import type { IncomingMessage, ServerResponse } from 'node:http';
import { productionHandler } from '../server/online/handler.js';
import { writeOnlineResponse } from '../server/online/response.js';
import { maxBodyBytes, OnlineHttpError, onlineFailure } from '../server/online/http.js';
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
      if (Number(req.headers['content-length']) > maxBodyBytes) {
        req.resume();
        throw new OnlineHttpError(413, 'BODY_TOO_LARGE', 'Petición demasiado grande.');
      }
      // Vercel's lazy getter may already have parsed/consumed the stream. Read once.
      let parsed: unknown;
      try {
        parsed =
          req.headers['content-length'] === '0' && !req.headers['transfer-encoding']
            ? undefined
            : req.body;
      } catch (error) {
        if (
          !(error instanceof SyntaxError) &&
          !(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 400)
        )
          throw error;
        throw new OnlineHttpError(
          400,
          'INVALID_JSON',
          'El cuerpo de la petición no contiene JSON válido.',
        );
      }
      if (parsed !== undefined) {
        body =
          parsed === null
            ? Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding']
              ? 'null'
              : undefined
            : Buffer.isBuffer(parsed)
              ? parsed.toString('utf8')
              : typeof parsed === 'string'
                ? parsed
                : JSON.stringify(parsed);
      } else {
        if (req.readableEnded && Number(req.headers['content-length']) > 0)
          throw new OnlineHttpError(
            400,
            'BODY_ALREADY_CONSUMED',
            'El cuerpo de la petición ya fue consumido y no está disponible.',
          );
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          const b = Buffer.from(chunk);
          size += b.length;
          if (size > maxBodyBytes) {
            req.resume();
            throw new OnlineHttpError(413, 'BODY_TOO_LARGE', 'Petición demasiado grande.');
          }
          chunks.push(b);
        }
        body = Buffer.concat(chunks).toString('utf8');
      }
      if (body !== undefined && Buffer.byteLength(body, 'utf8') > maxBodyBytes)
        throw new OnlineHttpError(413, 'BODY_TOO_LARGE', 'Petición demasiado grande.');
      // The parsed helper may have reserialized JSON with a different byte length.
      headers.delete('content-length');
    }
    const request = new Request(`https://${req.headers.host || 'monigones.vercel.app'}${req.url}`, {
      method: req.method,
      headers,
      body,
    });
    const response = await productionHandler()(request);
    await writeOnlineResponse(response, res, req.headers['accept-encoding']);
  } catch (error) {
    if (res.headersSent) {
      console.error('monigones.online', { code: 'RESPONSE_STREAM_FAILED' });
      res.destroy();
      return;
    }
    const failure = onlineFailure(error);
    res.writeHead(failure.status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(failure.body));
  }
}
