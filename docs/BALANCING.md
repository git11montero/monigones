# Balance y simulación

`npm run simulate` recorre 266 días, seis clubes y 38 jornadas con semilla reproducible, en tres escenarios: base, actividades sociales y primeras inversiones. Escribe saldos en céntimos, mínimos y violaciones en `simulation-results.json`.

Comprueba que todas las jornadas se liquiden, los saldos sean enteros seguros y la propiedad de jugadores no se duplique. No es una prueba exhaustiva de todas las combinaciones económicas ni un estudio con jugadores humanos.

La ejecución inicial dejó alrededor de 149–151 M€ por club al final desde aproximadamente 100 M€ líquidos. Es un escenario sin mercado agresivo ni desarrollo completo de la ciudad. El modelo tiene presión económica moderada; el exceso de liquidez requiere revisión en partidas reales. El avance automático no invierte inteligentemente en todas las tecnologías ni consume medallas.

Controles de explotación presentes: reserva de pujas; ventas ordinarias hasta VM; observación y VM de cantera; devolución parcial de obras; una acción institucional cada 48 h; prestigio mínimo para acciones avanzadas; un préstamo pendiente; cobros y premios idempotentes; coste salarial ligado al VM; mantenimiento cuadrático de estadio; recargos por plantilla por encima de doce; bonificaciones acotadas; límites de trabajos.

Pendiente para una edición competitiva: simulación con agentes estratégicos que operen mercado e instituciones, distribución robusta de ingresos comerciales, ayuda limitada para rezagados, análisis de concentración de talento y evaluación de progresión completa. Las cifras actuales son configuración de desarrollo, no balance competitivo certificado.
