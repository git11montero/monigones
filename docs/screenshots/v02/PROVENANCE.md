# Evidencia visual v0.2

- `map-before-390x844.png`: captura del commit inicial `f56d6f4310a212d3de409420e1b9144d25d98ae5`, extraído con `git archive` a `/tmp/monigones-v02-before.2ujrQ3`, con Node 22 y base nueva `/tmp/monigones-v02-before-review.sqlite`, puertos 3106/5176. Sin modificar Git ni partidas existentes.
- `map-after-390x844.png` y las capturas de funciones: revisión local de las mejoras, con otra base nueva `/tmp/monigones-v02-review.sqlite`, puertos 3105/5175. Las diferencias de saldos/fechas no son una comparativa económica.
- `scripts/review-v02.mjs`: recorrido reproducible en una vista local aislada. Usa comandos de demostración, por lo que debe apuntar a una instancia de QA con datos temporales.
- `review.json`: errores JavaScript, ancho de ventana/documento, selectores nativos e imágenes rotas para cada captura final.
- `regressions/`: capturas de la cobertura anterior, redirigidas aquí para conservar la evidencia histórica del primer rediseño.
- `index.html`: comparación interactiva y galería. Las dos imágenes de comparación tienen 390×844 exactos.
