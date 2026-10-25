# Demo Fantasy personalizada v0.6

Fuente única: [data/demo-fantasy-v06.json](../data/demo-fantasy-v06.json). Contiene equipo, presidente, formación, favorito, titulares, suplentes, identificadores internos, club real, nombre verificado y posición. La correspondencia se ha hecho con la **lista textual del adjunto**; sus cinco capturas no estaban incluidas como archivos de imagen, por lo que no se afirma una comparación visual con ellas.

| Presidente | Equipo | Formación | Titulares | Suplentes |
|---|---|---|---|---|
| demo1 | Cholo ATM | 3-3-4 | Abde, Raphinha, Lamine Yamal, Iñigo Vicente, **Fermín López**, Youssouf Fofana, Raúl Moro, Marcos Llorente, Laporte, Alex Freeman, Emil Audero | Toni Martínez, Hugo Novoa, Salvi Esquivel |
| demo2 | Porcinos FC | 4-2-4 | **Antony**, Yassir Zabiri, Isaac Romero, Giuliano Simeone, Álex Baena, Pedri, Marc Pubill, Pau Cubarsí, Xavi Espart, Jesús Areso, Oblak | — |
| demo3 | Madurito | 3-4-3 | Gonçalo Guedes, Yan Diomande, Brugué, Dani Ceballos, Edu Expósito, Mario Soriano, Pablo Barrios, Konaté, Aitor Paredes, Yoel Lago, Péter Gulácsi | — |
| demo4 | Juancarli Team | 3-4-3 | Fer Niño, Jonathan David, David Otorbi, Isco, Izan Merino, Arda Güler, Agoumé, José María Giménez, Catena, Valentini, Leo Román | — |
| demo5 | Joselinho | 3-3-4 | Budimir, Roberto Fernández, Satriano, Félix Correia, Bellingham, Carlos Soler, Luismi Cruz, Grimaldo, Justin de Haas, Adrià Pedrosa, Unai Simón | — |
| demo6 | Plaza reservada | 4-4-2 vacía | — | — |

**Fuente completa:** el usuario ha confirmado definitivamente A. Santos como **Antony Matheus dos Santos**, nombre deportivo Antony, Real Betis, `betis-17`, DEL. La fuente utiliza su registro existente, sin duplicarlo.

La corrección «E. López» → Fermín López, FC Barcelona, está aplicada. La inicial «D.» del portero Gulácsi no coincide con Péter; la identificación y la fuente aparecen en [la auditoría deportiva](SPORTS_CATALOG_AUDIT.md). Todas las identidades y posiciones completas se revisan en la previsualización antes de confirmar una carga.

## Diseño y uso actual

La fuente completa contiene **58 contratos** y deja vacía la sexta plaza. Se utiliza por defecto en demos avanzadas nuevas y en la sustitución controlada. La inicialización no sobrescribe partidas guardadas. Las ligas normales conservan sus reglas.

La dotación inicial es de 100 M€ por club, sin copiar puntos ni precios de capturas. Sede/estadio nivel 4, césped mínimo del dibujo, vestuario suficiente y banquillo nivel 4 con tres suplentes; calidades Básico y sin investigaciones regaladas. Se conservan salarios y cálculos del motor.

La validación comprueba identidad/club exactos, posiciones, once titulares, suplentes, capacidades y propietarios únicos. Ejecutar sin red ni credenciales:

```sh
npm run seed:online-demo -- --config examples/demo-fantasy-v06.config.json --offline-preview
```

Para **sustituir la liga existente conservando la cuenta y el UUID**, seguir [DEMO_REPLACEMENT.md](DEMO_REPLACEMENT.md). Incluye respaldo, vista previa, confirmación, transacción y restauración para SQLite y PostgreSQL. No ejecutar el importador de creación con la intención de sobrescribir una liga: sigue rechazando destinos ocupados y cambios incompatibles.

El importador de [ONLINE_DEMO_SEED.md](ONLINE_DEMO_SEED.md) continúa disponible para crear una liga en un destino nuevo, con cuentas reales sin membresía. No hace falta otra cuenta para el procedimiento independiente de sustitución de la demo existente.

No se han leído configuraciones privadas ni modificado partidas, Auth o servicios remotos durante esta preparación.
