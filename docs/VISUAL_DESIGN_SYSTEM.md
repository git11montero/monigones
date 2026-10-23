# Sistema visual

`src/game.css` contiene el sistema MONIGONES. `src/styles.css` conserva las reglas estructurales de las rutas existentes; los materiales y estados visuales nuevos las sustituyen mediante reglas explícitas. No se ha retirado una ruta para resolver un problema de estilo.

| Token      | Valor     | Uso                     |
| ---------- | --------- | ----------------------- |
| Fondo      | `#102540` | Mundo de interfaz y PWA |
| Superficie | `#203854` | Paneles y contratos     |
| Metal      | `#405573` | Borde y separación      |
| Oro        | `#efc875` | Acción y progreso       |
| Texto      | `#eaf0fb` | Lectura principal       |
| Secundario | `#a9bbd3` | Ayuda y contexto        |
| Carmesí    | `#ff9891` | Coste, pérdida y error  |

Los controles conservan las acciones `act()` del servidor: estado ocupado, bloqueo sin conexión, idempotencia y confirmación de respuesta. Botones con relieve y pulsación, pestañas empotradas, selects oscuros, barras con luz y cartelas numeradas. Estados disponibles, bloqueados, pendientes y completados tienen texto además de color.

`PlayerCard` admite variantes compacta, estándar, grande, mercado, draft y convocatoria. Las cartas no añaden rarezas de futbolista. El bloque CASILLA Básico/Bronce/Plata/Oro pertenece exclusivamente a la alineación; el porcentaje procede de la regla existente. Los retratos reales incluyen crédito en la ficha y en `/media`; los alternativos se identifican como ilustrados. Los emblemas ALT no son escudos oficiales.

`DepartmentScene` selecciona edificios o escenas interiores por ruta. Finanzas, institucional, conciertos, marketing y cantera usan escenas con su propia iluminación y personajes ficticios; investigación, estadio, museo y demás departamentos tienen arquitectura y color propios. Las doce instalaciones del estadio son dioramas individuales que abren un panel con su cotización real.

Columna vertical de máximo 460 px también en escritorio. Se comprueban 320, 390, 393 y 1440 px. Controles principales de aproximadamente 44 px; las cartelas del mapa se amplían con el mundo. La cámara tiene además botones y teclado. Foco visible, imágenes con alternativa, títulos semánticos, región de mapa descrita y diálogos con Escape, ciclo de Tab y restauración del foco. Las notificaciones no capturan el puntero. El movimiento reducido del sistema tiene prioridad sobre la preferencia del juego.
