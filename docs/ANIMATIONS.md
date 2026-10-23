# Animaciones y acontecimientos

| Disparador | Respuesta | Fuente |
|---|---|---|
| Pulsar | Descenso del botón y efecto breve | Interacción real |
| Abrir ventana | Deslizamiento desde el borde inferior y foco | Diálogo existente |
| Cambiar ruta | Entrada lateral corta | Router |
| Carta seleccionada | Elevación y reflejo | Foco/hover de la carta |
| Nueva contratación | Cartela y fanfarria | Contrato nuevo recibido del servidor |
| Comenzar obra | Grúa, barrera, herramienta y cartel de tiempo | `state.jobs` |
| Terminar obra | Salto de recompensa y arquitectura nueva | Trabajo desaparecido + nivel aumentado |
| Terminar investigación | Destello violeta y motivo ascendente | Investigación aumentada |
| Recompensa | Partículas y cartela | `act()` confirmado |
| Ganar/perder recursos | Cifra flotante positiva/negativa | Diferencia de recursos recibidos |
| Inicio de jornada | Cartela, focos y aficionados | Estado de jornada recibido |
| Gol | Golpe de escala y celebración | Aumento de goles del proveedor |
| Cambio manual | Entrada lateral | Acción confirmada |
| Final de jornada | Notificación de informe | Jornada liquidada |
| Ganar jornada | Celebración | Nuevo trofeo de ganador del servidor |
| Escándalo | Sacudida carmesí | Nueva noticia de Escándalos |
| Patrocinio | Cartela de firma | Contrato confirmado |
| Concierto | Cartela violeta y contexto musical | Contrato confirmado |

Las animaciones ambientales incluyen caminantes, aficionados adicionales, vehículo de servicio o autobús según el nivel del estadio, balón de entrenamiento, bandera de sede, iluminación de marketing y órbita de investigación. La cantidad de trabajadores y visitantes crece con el nivel. Son ambientación visual, no agentes que generen ingresos adicionales.

`Experience.tsx` compara estados recibidos y `api.tsx` emite feedback sólo tras respuesta satisfactoria. No se celebra una puja como fichaje: ofertar usa una notificación; el fichaje espera el cambio de contrato. La victoria utiliza el trofeo adjudicado y no un desempate inventado por la interfaz.

El audio y la presentación son independientes: silenciar no impide leer una recompensa. CSS incluye movimientos distintos para obra, gol, firma, carta, cambio y escándalo. `prefers-reduced-motion` y el ajuste de animaciones reducen duraciones; calidad baja suprime entidades ambientales. Los contadores siguen siendo funcionales.
