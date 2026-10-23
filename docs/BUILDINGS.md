# Ciudad e instalaciones

Los quince espacios están declarados en `BUILDINGS`: sede central, estadio, oficinas, investigación, marketing, cantera, dirección deportiva, entrenamiento, tienda, finanzas, afición, instituciones, prensa, museo y competición. Todos son accesos funcionales. Oficinas y competición carecen de nivel general; los trece edificios restantes van de uno a cinco.

La ciudad usa suelo SVG original y edificios superpuestos independientes. Sede, estadio e investigación tienen geometría especial; el resto comparte una familia arquitectónica. Los niveles cambian altura, ventanas y detalles. El estado de obra incorpora grúa, animación y contador; no se trata de un fondo único inmutable. El arte es estilizado y todavía admite una diferenciación mayor de fachadas por instalación.

La sede limita niveles de los demás edificios. Los plazos de grandes mejoras siguen 6, 24, 72 y 168 horas. Inicialmente hay una obra; Planificación de proyectos permite dos. Investigación tiene cola propia única. Cancelar obra devuelve el 50 %. Los proyectos de cantera tienen una cola propia y un inicio semanal.

Las doce instalaciones están en `FACILITIES`: gradas, vestuarios, banquillo, césped, LED, focos de espectáculos, videomarcador, VIP, cubierta, seguridad, servicios y aspersores. Ninguna supera su máximo ni el límite calculado por el estadio; a partir de la tercera mejora se requiere Dirección de obras.

Vestuarios suma una plaza por ampliación, hasta treinta. Su límite por estadio es cuatro ampliaciones por nivel, acotado a dieciocho. El banquillo admite exactamente la progresión solicitada de 0 a 7: `(suplentes, entradas) = (0,0),(1,1),(2,1),(2,2),(3,2),(3,3),(4,3),(4,4)`. El estadio limita su avance a nivel de estadio más dos, hasta siete.

El césped desbloquea por orden 4-4-2, 4-3-3, 3-5-2, 3-4-3 y 5-3-2. Cada formación conserva calidad por índice de casilla, pero requiere reasignar jugadores al cambiar de dibujo.

Hay nueve módulos de oficinas, declarados en `MODULES`. Contratos y compraventa parten abiertos; historial de pujas, cesiones, cláusulas, blindajes, renegociación, conciertos y administración se compran con sus requisitos. Los requisitos se validan en servidor incluso si se envía una acción manualmente.

Los edificios dan acceso a sistemas y, en estadio, investigación, tienda y entrenamiento, su nivel ya tiene efectos específicos. No todos los edificios secundarios tienen aún bonificaciones propias diferentes para cada uno de sus cinco niveles; esa profundidad está pendiente y se refleja en ROADMAP.
