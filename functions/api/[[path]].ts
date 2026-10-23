// Proxy opcional para servir la PWA y la API bajo el mismo origen en Cloudflare Pages.
// Configurar CROWN_API_ORIGIN con el backend Node HTTPS propio. No contiene credenciales.
export async function onRequest(context: { request: Request; env: { CROWN_API_ORIGIN?: string } }) {
  const origin = context.env.CROWN_API_ORIGIN;
  if (!origin)
    return Response.json(
      { error: 'Configura CROWN_API_ORIGIN: el alojamiento estático no incluye el motor.' },
      { status: 503 },
    );
  const incoming = new URL(context.request.url),
    target = new URL(origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers(context.request.headers);
  headers.delete('host');
  const upstream = await fetch(target.toString(), {
    method: context.request.method,
    headers,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
    redirect: 'manual',
  });
  const response = new Response(upstream.body, upstream);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
