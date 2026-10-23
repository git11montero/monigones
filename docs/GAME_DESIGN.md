# Diseño del juego

CROWN XI combina propiedad exclusiva de futbolistas por liga y temporada con una ciudad que progresa. El ciclo consiste en revisar las tres decisiones del día, estudiar cinco agentes libres, invertir en obras o tecnologías, preparar el once y competir en la jornada. Las instalaciones, los salarios y las fuentes comerciales conectan la progresión deportiva y económica.

La referencia gráfica es 390 × 844; escritorio usa la misma columna de hasta 460 px. Cinco destinos permanentes: Ciudad, Equipo, Mercado, Liga y Mi club. Los edificios son accesos reales a sus sistemas. No se permite visitar la ciudad de un rival; sí su museo y estadísticas públicas.

Cada liga mantiene un estado aislado, un administrador, usuarios y un único reloj. Una cuenta solo pertenece a una liga activa. El draft tiene presupuesto de 100 M€, aforo inicial de 12 futbolistas y prima de 20 M€. Los puestos sin ocupar se advierten y son responsabilidad del presidente. En la demostración se precargan doce jugadores por club y se registra su coste; las ligas nuevas empiezan sin plantilla.

La plantilla permite hasta treinta futbolistas. Un titular ausente puntúa cero; una casilla sin asignar recibe -5. Banquillo y cambios manuales son mecanismos diferentes. La convocatoria se cobra y congela una hora antes del primer encuentro. Las jornadas tienen diez encuentros simulados escalonados para poder probar sustituciones.

El motor opera con siete recursos, tres árboles y colas separadas para investigación y obras. Las oficinas no tienen nivel. Los módulos administran sus propios requisitos. No hay atributo de integridad ni rarezas de entrenador. La suerte no multiplica resultados deportivos.

Las decisiones institucionales usan nombres y entidades de ficción. La cobertura favorable concede fama permanente hasta que otra acción la modifique. Los conciertos solo pagan tras una jornada dentro de su vigencia, incluso si el club no obtuvo taquilla. Las marcas de patrocinio son inventadas; los artistas solo se representan como metadatos y carteles originales.

Una temporada tiene 38 jornadas, con ventanas semanales y cierre administrativo. El reinicio archiva la clasificación y conserva trofeos; reinicia presupuesto, plantilla, recursos, atributos y progresión. El calendario deportivo de todas las temporadas locales es una simulación del proveedor 2026/27, sin conexión a partidos reales.

La configuración numérica canónica está en `shared/config.ts`. Las reglas ejecutables están en `shared/engine.ts`; estos documentos explican sus decisiones, sin mantener otra tabla manual de costes.
