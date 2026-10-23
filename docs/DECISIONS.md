# Decisiones autónomas y motivos

1. **Servidor local autoritativo.** Node y SQLite permiten jugar con varios navegadores y conservar partidas sin servicios ni claves. Las operaciones económicas nunca dependen de localStorage.
2. **Agregado transaccional por liga en SQLite.** Hace posible reutilizar un único motor para juego, administrador y simulaciones. PostgreSQL normalizado es una migración posterior y se declara explícitamente pendiente.
3. **Una instancia de servidor por base.** Se serializan operaciones con `BEGIN IMMEDIATE`; no se simula soporte de clúster que no se ha construido.
4. **React, TypeScript, Vite, Router y TanStack Query.** Cumplen el stack preferido y permiten separar pantallas, datos y reglas. CSS propio sustituye Tailwind; las animaciones de CSS evitan un motor pesado para el mapa.
5. **SVG paramétrico original.** Evita derechos inciertos y archivos rotos; permite cambiar edificio, nivel y estado de forma independiente.
6. **Ancho máximo 460 px.** Mantiene la experiencia exclusivamente móvil incluso en un monitor ancho. Referencia de pruebas 390 × 844.
7. **Quince espacios disponibles desde el inicio.** Permite explorar todos los sistemas; la progresión depende de niveles, módulos, costes y requisitos.
8. **Seis clubes demo con plantilla asignada.** Facilita probar jornadas inmediatamente. Se cobra su valor y se registra la prima de draft; las ligas reales nuevas empiezan sin jugadores.
9. **Hasta veinte miembros en el modelo local.** Amplía el grupo objetivo de cinco a diez sin obligar a alcanzar diez para empezar pruebas.
10. **390 altas contrastadas y 110 identidades ficticias.** Ofrece un catálogo amplio sin presentar como verificadas plantillas completas que las fuentes accesibles no garantizan.
11. **VM, estados y puntos simulados para todos.** No hay licencia ni feed deportivo autorizado conectado. La identidad real no implica estadísticas reales.
12. **Céntimos y centésimas enteras.** Evita saldos con residuos de coma flotante. Bonificaciones con ratios y política de redondeo uniforme.
13. **Reserva del total de ofertas abiertas y puja líder.** Impide comprometer varias veces la misma tesorería. Las deudas sobrevenidas pueden invalidar una adjudicación.
14. **Desempate por atractivo, tiempo e ID.** Mantiene un resultado reproducible, independiente del orden incidental de lectura de las ofertas.
15. **Sorteos económicos con HMAC-SHA-256 y semilla privada.** Permite reproducir auditorías conservando secreto el estado que determina futuros sorteos. Los puntos ficticios usan un hash determinista independiente.
16. **Ciclo diario a las 06:00 de Madrid.** Las tres actividades, mercado y patrocinio comparten ciclo; medianoche no concede otro lote de acciones. Las conversiones consideran los cambios de horario.
17. **Partidos simulados escalonados.** Hace posible probar entradas automáticas pendientes y cambios manuales entre encuentros.
18. **Sustitución automática por orden de casilla.** Entre ausentes de una demarcación entra primero el primer titular por índice cuyo suplente haya finalizado y tenga minutos. El mismo suplente nunca entra dos veces; las entradas manuales no consumen el cupo automático.
19. **Transferencias de convocados bloqueadas durante la jornada.** Evita cambiar propiedad en mitad de un cálculo congelado. Las plazas del cedente quedan reservadas hasta el regreso.
20. **Formaciones conservan calidad por índice.** Cambiar el dibujo requiere reasignar futbolistas y no permite comprar calidad moviendo jugadores.
21. **Investigación secuencial con uniones explícitas.** Tres ramas por árbol, 49 nodos y 61 niveles permiten progresión completa sin dependencias cíclicas. Los costes salen de una fuente común.
22. **Requisito de Dirección de obras para instalaciones avanzadas.** Añade una puerta de progresión coherente sin inventar un nivel de oficinas.
23. **Cancelación de obras al 50 %; investigación no cancelable.** Simplifica la protección frente a repetición y mantiene coste de oportunidad.
24. **Cantera paga observación y VM.** Evita producir jugadores gratuitos y venderlos indefinidamente; un proyecto semanal limita el ritmo.
25. **Conciertos de catorce días.** Pagan al cerrar jornadas durante la vigencia; gastos al firmar, tres propuestas semanales y una contratación activa por club.
26. **Patrocinios por espacio y día.** Las fechas y pagos quedan registrados, no aumentan la fama al firmar y el videomarcador limita sus huecos.
27. **Palanca con sanción acotada a cinco puntos.** Se preserva la sátira y el riesgo, con prestigio mínimo, multas y cooldown que limitan su repetición. No existe atributo de integridad.
28. **Fondo televisivo de 1,5 M€ por participante.** Mantiene ingresos de todos los clubes y reduce diferencias con mitad inversa; es configuración revisable, no balance final.
29. **Premios explícitos por evento.** La reclamación única produce dinero, PD, medallas y trofeo; el evento de entrenador incorpora un entrenador sin rarezas y conserva su desbloqueo durante la temporada.
30. **Periódico por plantillas de hechos registrados.** No usa una API de IA ni inventa fichajes para llenar una portada.
31. **SSE con invalidación y sondeo de recuperación.** Resuelve multijugador local sin añadir un servidor de sockets; los datos siguen pasando por autorización HTTP.
32. **Caché offline de lectura por usuario.** La sesión pública de pestaña permite recargar la copia, pero ninguna operación se encola o da por confirmada sin servidor.
33. **Herramientas de administrador comprobadas también en servidor.** Ocultar botones no es una medida suficiente; demo y avance de tiempo se desactivan por defecto en producción.
34. **Supabase Auth opcional independiente de persistencia.** Validar un JWT no equivale a haber migrado todo el backend; la entrega distingue ambos trabajos.
35. **Despliegue no ejecutado.** Se respeta el pedido de trabajar sobre este repositorio y no modificar servicios remotos. Se incluyen pasos y un proxy revisable, sin afirmar un alojamiento integral ya operativo.
36. **Pruebas y resultados separados del marketing.** Las comprobaciones locales, de navegador, de producción PWA y las no realizadas se registran en TESTING y DELIVERY.
