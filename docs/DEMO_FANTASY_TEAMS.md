# Demo Fantasy personalizada v0.6

Fuente única: [data/demo-fantasy-v06.json](../data/demo-fantasy-v06.json). Contiene equipo, presidente, formación, favorito, titulares, suplentes, identificadores internos, club real, nombre verificado y posición. La correspondencia se ha hecho con la **lista textual del adjunto**; sus cinco capturas no estaban incluidas como archivos de imagen, por lo que no se afirma una comparación visual con ellas.

| Presidente | Equipo | Formación | Titulares | Suplentes |
|---|---|---|---|---|
| demo1 | Cholo ATM | 3-3-4 | Abde, Raphinha, Lamine Yamal, Iñigo Vicente, **Fermín López**, Youssouf Fofana, Raúl Moro, Marcos Llorente, Laporte, Alex Freeman, Emil Audero | Toni Martínez, Hugo Novoa, Salvi Esquivel |
| demo2 | Porcinos FC | 4-2-4 | **A. Santos pendiente**, Yassir Zabiri, Isaac Romero, Giuliano Simeone, Álex Baena, Pedri, Marc Pubill, Pau Cubarsí, Xavi Espart, Jesús Areso, Oblak | — |
| demo3 | Madurito | 3-4-3 | Gonçalo Guedes, Yan Diomande, Brugué, Dani Ceballos, Edu Expósito, Mario Soriano, Pablo Barrios, Konaté, Aitor Paredes, Yoel Lago, Péter Gulácsi | — |
| demo4 | Juancarli Team | 3-4-3 | Fer Niño, Jonathan David, David Otorbi, Isco, Izan Merino, Arda Güler, Agoumé, José María Giménez, Catena, Valentini, Leo Román | — |
| demo5 | Joselinho | 3-3-4 | Budimir, Roberto Fernández, Satriano, Félix Correia, Bellingham, Carlos Soler, Luismi Cruz, Grimaldo, Justin de Haas, Adrià Pedrosa, Unai Simón | — |
| demo6 | Plaza reservada | 4-4-2 vacía | — | — |

**La demo real no puede importarse todavía**: A. Santos tiene `playerId: null`. El usuario indicó expresamente que no debe asignarse automáticamente a Antony. Confirmada su identidad, seleccionar su registro verificado (o actualizar primero el catálogo con una fuente), completar ID/nombre/club/posición y revisar la formación si su demarcación lo exige. Nunca sustituirlo por el jugador de la fixture de pruebas.

La corrección «E. López» → Fermín López, FC Barcelona, está aplicada. La inicial «D.» del portero Gulácsi no coincide con Péter; la identificación y la fuente aparecen en [la auditoría deportiva](SPORTS_CATALOG_AUDIT.md). Todas las identidades y posiciones completas se revisan en la previsualización antes de confirmar una carga.

## Diseño y límites

Se crea **una liga nueva con otro UUID** usando las RPC existentes, modo `advanced`. No se actualiza la demo actual ni se borra su sexto club. El nuevo sexto club queda reservado sin contratos. No se necesitan migraciones adicionales.

La fuente es un escenario inicial: asignaciones de jugadores a coste cero, registradas como tales, dotación de 100.000.000€ por club y valores/salarios normales del motor. No se copian precios ni puntos de las capturas. Sede/estadio nivel 4, césped mínimo del dibujo, vestuarios suficientes y banquillo nivel 4 cuando hay tres suplentes; calidades Básico y sin investigaciones regaladas. Son parámetros de esta nueva demo, no cambios de reglas ni recompensas para ligas existentes.

El validador comprueba duplicados globales, cinco presidentes distintos, 11 titulares, distribución por posición, un suplente por demarcación, capacidad, identidad/club exactos y contratos propios. La fuente completa de prueba tiene 58 contratos. La sexta plaza sigue vacía.

La importación conserva las garantías existentes: transacción PostgreSQL, bloqueo, hash de fuente/petición, registro de ejecución, idempotencia, comprobación de reloj/Auth/membresía y rechazo de destinos ocupados, configuraciones distintas o ligas modificadas. **Una cuenta solo puede tener una membresía** en la arquitectura actual: para esta segunda liga hacen falta cuentas Auth de prueba sin membresía, no las ya asociadas a la liga original. No eliminar ni reasignar usuarios para eludirlo.

No se ofrece actualización de la liga jugada. Si se quisiera actualizarla, haría falta otro trabajo explícito con respaldo, verificación de progreso y autorización. Este importador no la sobrescribe.

## Comandos de uso

Previsualización completamente local, sin credenciales, Auth ni red; ahora termina con código 1 explicando A. Santos:

```sh
npm run seed:online-demo -- --config examples/demo-fantasy-v06.config.json --offline-preview
```

Después de resolver la identidad y **cuando se autorice la operación remota**:

```sh
cp examples/demo-fantasy-v06.config.json .monigones-demo/v06.config.json
```

Editar ese archivo privado: `environment=production`, `projectRef` real, **UUID de liga nuevo**, `adminUserId` y `users` de las cuentas nuevas; conservar `mode=advanced`, semilla fija, `startAt=now` y `fantasyTeams=../data/demo-fantasy-v06.json`. Los UUID del ejemplo son ficticios y no corresponden a usuarios existentes. El archivo privado de credenciales debe definir `MONIGONES_DEMO_SUPABASE_URL` y `MONIGONES_DEMO_SECRET_KEY` (servidor; nunca `VITE_`). No se ha leído ni cambiado el archivo privado actual.

```sh
npm run seed:online-demo -- --config .monigones-demo/v06.config.json --offline-preview
npm run seed:online-demo -- --config .monigones-demo/v06.config.json --env-file .monigones-demo/credentials.env --dry-run
npm run seed:online-demo -- --config .monigones-demo/v06.config.json --env-file .monigones-demo/credentials.env --apply
npm run seed:online-demo -- --config .monigones-demo/v06.config.json --env-file .monigones-demo/credentials.env --verify
```

`--dry-run` sí realiza lecturas remotas y consulta Auth, pero no escribe. `--apply` exige terminal interactiva y la frase exacta `CARGAR <projectRef> <leagueId>`; vuelve a validar los datos justo antes de la transacción. `--verify` comprueba persistencia/membresías. No se ha ejecutado ninguno contra Supabase remoto durante este desarrollo.
