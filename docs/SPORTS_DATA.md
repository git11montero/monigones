# Datos deportivos

Referencia consultada el **23 de octubre de 2026**, temporada 2026/27. La [lista oficial de LaLiga](https://www.laliga.com/laliga-easports/clubes) confirma los veinte clubes del encargo. Las páginas oficiales de plantilla no entregaron sus listas en el contenido navegable. Se contrastaron altas con las veinte fichas de la [guía de AS](https://as.com/futbol/primera/guia-de-laliga-ea-sports-202627-equipos-plantillas-fichajes-y-jugadores-a-seguir-f202608-n/).

Hay **500 registros: 390 identidades con fuente y 110 identidades ficticias**. Cada real contiene su URL específica y fecha de consulta; `data/players.json` permite auditarlas individualmente. La pertenencia refleja lo descrito por las fichas consultadas, no una sincronización oficial al minuto. Los nombres deportivos abreviados se conservan si el nombre completo no se ha contrastado. Algunas fichas contienen inconsistencias o datos ambiguos: no se incorporaron edades ni biografías. La demarcación fantasy es una adaptación editorial de su línea de juego, no una clasificación oficial de Fantasy MARCA.

**Todos** los valores de mercado, sus variaciones, estados de disponibilidad, estadísticas, contratos, felicidad, resultados y puntos de la partida son simulados, incluidos los jugadores de identidad real. `simulated` distingue la identidad ficticia; el contexto del proveedor y los avisos de interfaz indican que sus datos deportivos son simulados. El seed no es un catálogo completo oficial de todas las plantillas.

El roster se completa por cuotas de posiciones con nombres ficticios identificados en la interfaz. No se han descargado fotos ni escudos. `avatar`, `externalIds`, `fullName` y URLs permiten incorporar recursos autorizados posteriormente.

`SportsProvider` define temporada, clubes, jugadores, calendario, jornadas, encuentros, resultados, estadísticas, puntos, VM, historial, entrenadores, sincronización y fecha de actualización. `MockSportsProvider` lo implementa; `ExternalSportsProvider` es el contrato abstracto para una integración autorizada. No contacta con endpoints privados ni elude restricciones.

`ImportSportsProvider` valida JSON y CSV con Zod; normaliza nombres NFC y rechaza IDs duplicados, clubes desconocidos, posiciones inválidas, valores no enteros e identidades reales sin fuente. La importación administrativa local es transaccional y registra versión y fecha en `sync_logs`. No se reemplazan jugadores que tienen contrato activo. Las correcciones de plantilla de jugadores ya contratados necesitan una operación de sincronización específica todavía pendiente.

Ejemplo JSON, con valores en céntimos:

```json
{
  "version": "mi-catalogo-1",
  "players": [
    {
      "id": "externo-1",
      "name": "Jugador de prueba",
      "realClubId": "madrid",
      "position": "MED",
      "value": 150000000,
      "simulated": true
    }
  ]
}
```

CSV: cabecera `id,name,realClubId,position,value,simulated,source`. Admite campos entre comillas y comillas duplicadas; no campos con saltos de línea. Valida con `npm run sports:validate -- archivo.csv`. La versión CSV es `csv-1`. El importador no ejecuta scraping. Los errores se devuelven sin guardar cambios parciales. No se ha implementado aún un trabajador de sincronización externa con reintentos y backoff; es parte de la integración de proveedor pendiente.
