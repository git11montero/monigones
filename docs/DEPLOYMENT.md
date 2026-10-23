# Ejecución, despliegue e instalación

## Local

`npm ci && npm run dev` inicia Vite en 5173 y Node en 3001. Abre http://localhost:5173. No se necesita ninguna clave externa. Las seis cuentas demo y el laboratorio están disponibles por defecto en desarrollo. Para navegar con presidentes simultáneos utiliza perfiles de navegador diferentes: la cookie pertenece al perfil, no a la pestaña.

Copia `.env.example` a `.env` únicamente si necesitas cambiar la configuración. El servidor carga ese archivo. Cambios de variables requieren reiniciar los procesos. Las cuentas demo se crean al inicializar una base con demo habilitada.

Para otras máquinas de la misma red, Vite escucha en `0.0.0.0`. Usa la IP del equipo y configura `PUBLIC_ORIGIN=http://IP:5173` para autorizar ese origen; el backend puede seguir en loopback gracias al proxy. HTTP por IP no permite instalación PWA completa: utiliza un origen HTTPS para probar instalación en teléfonos.

## Build autocontenido con API Node

```sh
npm run build
CROWN_DB=./data/crown.sqlite npm run start
```

Node sirve `dist/` y `/api/` desde el mismo puerto. Por defecto, `NODE_ENV=production` desactiva demo y herramientas de tiempo. Si `.env` las activa explícitamente, prevalece ese valor: fija `CROWN_DEMO=false` y `CROWN_ADMIN_TOOLS=false` al publicar una partida. No uses un disco efímero como persistencia de una temporada.

En un servidor propio, configura `HOST=0.0.0.0`, un volumen permanente para `CROWN_DB`, un proceso supervisado y un proxy HTTPS que preserve SSE. Fija `PUBLIC_ORIGIN` al origen público y `COOKIE_SECURE=true`. Evita dos procesos con bases independientes para una misma liga. Esta ruta no depende de una tienda de aplicaciones, pero presupone un equipo o servidor disponible; no se promete alojamiento externo gratuito con disco persistente.

## Frontend en Cloudflare Pages

La guía oficial de [React en Pages](https://developers.cloudflare.com/pages/framework-guides/) y la de [Pages Functions](https://developers.cloudflare.com/pages/functions/) describen el alojamiento estático y la ejecución de funciones. El plan y cuotas deben comprobarse en el servicio al desplegar.

1. Crear un proyecto nuevo desde tu repositorio, sin reutilizar proyectos ajenos.
2. Comando de build `npm run build`; salida `dist`; versión de Node compatible.
3. Conservar `public/_redirects` para rutas de la SPA y `public/_headers` para cabeceras básicas.
4. Si se utiliza el backend Node, desplegar `functions/api/[[path]].ts` y configurar `CROWN_API_ORIGIN` con su origen HTTPS. Configurar en Node `PUBLIC_ORIGIN` con el origen de Pages.
5. Mantener frontend y API bajo el mismo origen público mediante ese proxy; las cookies son `SameSite=Strict`. `VITE_API_URL` por sí sola no resuelve autenticación entre sitios distintos.

**Subir solo `dist` no despliega el juego completo.** Se verá una interfaz sin API operativa. El proxy devuelve 503 si no hay backend configurado. No se ha probado un despliegue externo de Pages ni este proxy en Cloudflare. La modalidad gratuita integral solicitada todavía necesita completar el adaptador servidor/PostgreSQL o un runtime compatible con persistencia gratuita.

## Supabase

[Supabase ofrece modalidad Free](https://supabase.com/pricing). A la fecha de consulta, sus límites incluyen tamaño de base, tráfico y pausado por inactividad; revisar su página antes de crear la liga definitiva. No se ha creado un proyecto remoto.

Para probar autenticación real, configura `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. El frontend solicita sesión a Supabase y el backend valida el JWT mediante `auth.getUser`. La confirmación de correo depende de los ajustes del proyecto. Esas variables no migran las partidas: SQLite sigue siendo el adaptador activo.

Aplica la migración y el seed únicamente en un proyecto de pruebas nuevo. Antes de usarlo en producción faltan verificar SQL/RLS, vistas de lectura, RPC de todas las operaciones, persistencia normalizada, trabajadores programados y Realtime nativo. Véase DATABASE y ROADMAP. No se expone ninguna clave `service_role` en la PWA.

## Android, iPhone y escritorio

En un origen HTTPS con backend accesible:

- Android: abrir en Chrome → menú → Instalar aplicación.
- iPhone: abrir en Safari → Compartir → Añadir a pantalla de inicio.
- Chrome/Edge de escritorio: icono de instalación de la barra de direcciones.

La aplicación conserva orientación de diseño vertical y áreas seguras; no convierte escritorio en dashboard. `manifest.webmanifest`, PNG de 192/512, `start_url`, `scope`, `display:standalone` y `orientation:portrait` se generan con el build. iOS puede ignorar el bloqueo de orientación del manifest: el diseño sigue siendo de columna.

La caché contiene solo recursos estáticos; la copia de partida es de lectura. No se confirma ninguna compra, mensaje ni recompensa sin respuesta del servidor. Las actualizaciones del service worker se aplican al cerrar las instancias anteriores; no se fuerza una recarga que interrumpa un formulario. La instalación física en Android e iOS no se ha probado con dispositivos en este entorno.
