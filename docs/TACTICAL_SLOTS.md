# Once casillas persistentes

No cambia el formato guardado: `selection.starters` tiene once entradas; cada índice conserva `quality` y `unlockedQuality`. No son mejoras del futbolista ni un almacén separado por formación. Básico/Bronce/Plata/Oro mantienen bonus 0/5/12/25% y sobrecoste salarial 0/0,10/0,30/0,75 puntos porcentuales.

La correspondencia es **índice a índice**. Casilla 1: POR. Las 2–11 siguen las líneas DEF, MED, DEL del dibujo, incluidas las varias líneas de medios. Ejemplo:

| Casilla visible | 4-4-2 | 3-3-4 |
|---|---|---|
| 1 | POR | POR |
| 2–4 | DEF | DEF |
| 5 | DEF | MED |
| 6–7 | MED | MED |
| 8–9 | MED | DEL |
| 10–11 | DEL | DEL |

Cambiar el dibujo mediante el motor conserva las once calidades y recoloca solo futbolistas compatibles, dejando libres las plazas necesarias. Los índices nunca se duplican; investigación y puntuación siguen usando las mismas entradas. Las convocatorias congeladas mantienen sus restricciones.

Entrenamiento utiliza `tacticalSlots()` como proyección de lectura: su selector tiene estado local y no envía el comando `formation`. Consultar 3-3-4 muestra exactamente qué índice y calidad representaría cada posición, con aviso de su posición activa si cambia. Solo el botón de calidad actúa sobre la casilla persistente indicada. La selección de un dibujo bloqueado respeta el nivel de césped; una consulta no cambia jugadores, sueldo, investigación ni puntuación.

Las categorías tienen nombre, icono, borde y bonus además de gris/cobre/plata/oro. No hace falta migración SQL ni conversión de partidas. Cubierto por pruebas de todas las formaciones, lectura sin mutación y cambios concurrentes persistidos en PostgreSQL real desechable.
