# Decisiones del rediseño

1. **Compatibilidad:** conservar IDs, contratos, saldos, selecciones, temporizadores, claves crown-* y esquema SQLite. La marca visible cambia mediante `shared/brand.ts`; no se hace una migración destructiva.
2. **Motor:** DOM/SVG con atlas y una cámara matricial. Ofrece imágenes de mucha calidad, enlaces accesibles y control táctil sin añadir un motor de juego pesado al servidor existente.
3. **Ciudad:** mundo continuo de 1420 × 1920, estadio central, sede al norte, campus deportivo al este y departamentos sociales al sur. Se explora con cámara, no con una lista de tarjetas.
4. **Arte:** nueve originales generados con imagegen y compresión WebP local. Los originales se conservan. Los recortes se midieron por alfa porque la generación no respetó perfectamente los márgenes de las celdas.
5. **Niveles:** trece edificios tienen cinco arquitecturas. Oficinas y competición siguen siendo accesos sin nivel general, aunque el atlas contenga bocetos adicionales. No se introducen mejoras económicas nuevas para justificar dibujos.
6. **Interiores:** escenas de departamento, instalaciones como dioramas seleccionables, comparación antes/después y beneficios que sí existen en el motor. Cuando un nivel es visual y no añade un multiplicador pasivo, se indica al comprarlo.
7. **Investigación:** lista por árbol y capítulo, tres ramas conservadas, requisitos navegables y convergencias visibles en el detalle; sin un gran árbol que obligue a desplazar horizontalmente el móvil.
8. **Fantasy:** cartas propias, emblemas y retratos por ID, calidad exclusivamente de la casilla y puntos con dos decimales. Se mantiene la separación entre identidad real y valores/resultados simulados.
9. **Fotografías:** seis verificadas prioritarias y 384 pendientes. No se asocian personas por parecido de nombre ni se descargan fotos de agencias sin una licencia adecuada. Los veinte escudos oficiales siguen pendientes: se utilizan alternativas originales identificadas como ALT.
10. **Audio:** síntesis original, buses separados, tres contextos musicales, preferencias y desbloqueo por gesto. No se incluyen canciones de los artistas del catálogo.
11. **Acontecimientos:** animar respuestas confirmadas y diferencias del estado. La puja no es un fichaje y una decisión legal no es un escándalo. La victoria requiere el trofeo real del servidor.
12. **Caché:** atlas en precache; fotografías optimizadas con caché bajo demanda y caducidad. Las fotografías futuras no deben multiplicar el tamaño inicial de instalación.
13. **Pruebas:** bases independientes bajo `/tmp`, capturas anteriores conservadas y comparación por rutas. Estados de nivel 3/5 preparados como fixtures; obras, firmas, conciertos, draft y jornadas pasan por las acciones reales.
14. **Alcance externo:** se trabaja en el repositorio. No se publica, no se contratan proveedores, no se envían mensajes ni se habilita una base remota. La persistencia remota completa de Supabase sigue pendiente del proyecto anterior.
