import type { ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
/** Stream full histories instead of buffering a >4.5 MB Vercel Function response. */
export async function writeOnlineResponse(
  response: Response,
  res: ServerResponse,
  acceptEncoding = '',
) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  const gzip = acceptEncoding
    .split(',')
    .some((part) => /^\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?\s*$)[\d.]+)?\s*$/.test(part));
  if (gzip) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  // Flush headers explicitly and honor backpressure. This is an ordinary finite
  // response stream, not a persistent SSE connection or an in-memory room.
  res.flushHeaders();
  async function* chunks() {
    for await (const value of Readable.fromWeb(response.body as any)) {
      const buffer = Buffer.from(value);
      for (let offset = 0; offset < buffer.length; offset += 65536)
        yield buffer.subarray(offset, offset + 65536);
    }
  }
  const source = Readable.from(chunks());
  if (gzip) await pipeline(source, createGzip(), res);
  else await pipeline(source, res);
}
