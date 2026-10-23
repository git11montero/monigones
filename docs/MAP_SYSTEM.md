# Sistema del mapa

Renderizador DOM + SVG con atlas raster: mundo de **1420 × 1920** unidades, una única transformación `translate3d(x,y,0) scale(zoom)` y origen superior izquierdo. Los edificios, el terreno y los personajes comparten coordenadas. No se utiliza el desplazamiento de página para explorar la ciudad.

`src/lib/visuals.ts` mantiene posiciones, temas, dimensiones, restricciones y funciones puras de cámara. `City.tsx` conecta la cámara a Pointer Events. Arrastre con umbral de 5 px, captura del puntero, dos punteros para pellizco y zoom alrededor de su punto medio. La rueda amplía alrededor del cursor. Un arrastre suprime la selección al levantar el dedo. Pointer cancel limpia el gesto.

Zoom entre 0,27 y 1,15; vista general, centrar estadio, +/− y selector de los quince departamentos. El teclado utiliza flechas, +/− y Home cuando el mapa tiene el foco. Los enlaces de edificios permiten también navegación por teclado. Las restricciones permiten margen alrededor del mundo sin perderlo completamente.

El catálogo visual está separado de `shared/config.ts`: no cambia costes, duración, niveles máximos ni IDs de edificios. La apariencia toma `club.buildings`, las obras toman `state.jobs` y los contadores usan `state.now` del servidor. No hay un reloj local que adjudique edificios. El nivel que llega del servidor selecciona otro recorte del atlas. Oficinas y competición no presentan nivel general.

`cityEnvironment()` devuelve partido si la jornada y un encuentro están en juego; concierto si hay un contrato vigente; normal en otro caso. Se añaden aficionados y focos en partido. La música selecciona el contexto equivalente. Fuera de partidos vuelve el ambiente habitual. Los goles se anuncian únicamente al aumentar los goles de las estadísticas recibidas mientras la jornada sigue en juego.

La calidad alta dibuja más personajes según el nivel; media reduce su número y baja elimina la capa ambiental. En todas se conserva la arquitectura ilustrada. Movimiento reducido detiene las animaciones ambientales. Los atlas WebP comparten las descargas y se precargan mediante el service worker. La escena contiene decenas de entidades, no una simulación física de miles de habitantes; no se presenta como un motor 3D.

Las pruebas de niveles preparan estados de nivel 1, 3 y 5 exclusivamente en `/tmp/crown-e2e-*.sqlite`, con comprobación obligatoria de la ruta. No existe un editor de niveles nuevo en producción y no se modifica `data/crown.sqlite` para las capturas.
