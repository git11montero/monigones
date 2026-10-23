# Investigación

Tres árboles exactos: Finanzas (16 nodos), Competición (18) y Relaciones (15). Cada árbol tiene tres ramas; los nodos conservan identificador, fila, rama, requisitos, nivel máximo, efectos y requisito de centro. Hay 49 tecnologías distintas y 61 niveles investigables en total (Gestión salarial, Venta inteligente y Negociador deportivo tienen cinco niveles; las restantes, uno).

`RESEARCH` en `shared/config.ts` es la fuente. `data/catalogs.json` contiene el catálogo estructurado completo. No se mantiene una segunda lista manual. Las pruebas recorren todas las dependencias y comprueban que no haya ciclos ni referencias rotas.

Finanzas: Tesorería, Negocios e Infraestructura. Competición: Rendimiento, Plantilla y Preparación. Relaciones: Comunicación, Afición e Influencia. Cada rama es secuencial y los nodos integrales de Finanzas y Relaciones reúnen varias ramas. La interfaz muestra conexiones verticales; los requisitos cruzados se consultan en el panel del nodo. La representación gráfica de las conexiones entre ramas todavía se puede mejorar.

Solo una investigación puede estar activa por club entre los tres árboles. No se permite iniciar el mismo nivel dos veces. Se cobra dinero y PD al inicio; el servidor aplica sus efectos al terminar. Las investigaciones no se pueden cancelar en esta edición. Los costes dependen del nivel y fila del nodo, con los cinco tramos centralizados solicitados. Las reducciones de duración se limitan al 30 %.

Los clausulazos se desbloquean exclusivamente en las oficinas desde el día 50; no hay nodo que los conceda. La progresión de fama amplía el techo de 10 a 25, 50, 75 y 100. Dos nodos amplían el prestigio de 50 a 75 y 100. La reducción salarial nunca supera 1,5 puntos porcentuales. Las mejoras deportivas se suman al entrenador dentro del límite adicional del 25 %.
