/** Errors whose public message/status are deliberate. Never include bodies or credentials. */
export class OnlineHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly diagnostic?: { rpc: string; upstreamStatus?: number },
  ) {
    super(message);
  }
}
export function onlineFailure(error: unknown) {
  if (error instanceof OnlineHttpError) {
    if (error.status >= 500)
      console.error('monigones.online', { code: error.code, ...error.diagnostic });
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  // The shared motor uses ordinary Error for business invariants. Native runtime
  // errors are server failures, not an invalid user command or a bad password.
  if (error instanceof Error && error.constructor === Error)
    return { status: 400, body: { error: error.message, code: 'OPERATION_REJECTED' } };
  console.error('monigones.online', {
    code: 'INTERNAL_ERROR',
    kind: error instanceof Error ? error.name : 'unknown',
  });
  return {
    status: 500,
    body: { error: 'Error interno del backend online.', code: 'INTERNAL_ERROR' },
  };
}
export const maxBodyBytes = 512000;
export async function readJsonObject(request: Request, required: boolean) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBodyBytes)
    throw new OnlineHttpError(413, 'BODY_TOO_LARGE', 'Petición demasiado grande.');
  if (!raw.trim()) {
    if (required)
      throw new OnlineHttpError(400, 'JSON_BODY_REQUIRED', 'Esta ruta requiere un cuerpo JSON.');
    return undefined;
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new OnlineHttpError(
      400,
      'INVALID_JSON',
      'El cuerpo de la petición no contiene JSON válido.',
    );
  }
  if (!body || Array.isArray(body) || typeof body !== 'object')
    throw new OnlineHttpError(400, 'JSON_OBJECT_REQUIRED', 'El cuerpo JSON debe ser un objeto.');
  return body as Record<string, unknown>;
}
