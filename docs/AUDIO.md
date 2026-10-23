# Audio original

Gestor único en `src/lib/audio.ts`, Web Audio API y compatibilidad con `webkitAudioContext`. No se descargan muestras ni se incluyen canciones comerciales. Los motivos y la composición procedural son originales del proyecto.

La música combina acordes suaves, una figura melódica y, para partido/concierto, percusión tonal. Hay progresiones diferentes para ciudad, jornada y concierto. Los efectos incluyen pulsación, apertura, fichaje, recompensa, monedas, obra, investigación, nivel, notificación, gol, estadio, victoria, derrota, cambio, escándalo, patrocinio y concierto. El ambiente de estadio añade un soplo de público sintetizado; no es una grabación de una hinchada.

Música desactivada inicialmente, efectos activados y volumen 35 %. El contexto se crea y reanuda después de un gesto del usuario. El botón del HUD alterna música; Ajustes permite música, efectos, volumen y prueba de efecto. `monigones-preferences-v1` recuerda los valores, con validación de datos corruptos.

Los buses independientes de música y efectos silencian también voces ya iniciadas. Límite global de doce voces y separación mínima de 45 ms entre motivos. Los nodos se desconectan al terminar. Al ocultar la pestaña se suspende el contexto; un gesto posterior lo reanuda. No se reproduce música por el mero hecho de cargar la página.

Las pruebas instrumentan la creación de osciladores en el navegador para comprobar gesto, efectos, silencio y persistencia. No sustituyen una escucha en altavoces reales ni una evaluación musical profesional. La música es una composición sintetizada breve, no una banda sonora grabada.
