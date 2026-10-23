# Economía y puntuación

Todos los importes son céntimos enteros y los puntos son centésimas enteras. Las multiplicaciones usan ratios enteros y redondeo al entero más próximo (`Math.round`; las bonificaciones solo se aplican a bases positivas). Se comprueba el rango entero seguro al modificar recursos. No se utilizan euros decimales en el libro mayor.

Presupuesto inicial y prima, costes, tiempos, topes y tablas de progresión están en `RULES` en `shared/config.ts`, exportado en `data/catalogs.json`.

Las ofertas del mercado reservan el importe; no lo cobran antes de la adjudicación. También se reserva la puja ganadora de subastas abiertas. Modificar una oferta sustituye su reserva. Las reservas evitan prometer el mismo presupuesto a cinco agentes y gastarlo en una obra. Si una deuda reduce el saldo antes de adjudicar, se salta la oferta que ya no puede pagarse.

El rechazo sigue la fórmula solicitada: `clamp(50 - 100*(oferta/VM - 1) - 10*(salario_pp - 2) - 0.05*fama, 2, 50)`. El atractivo es `0.85*oferta/VM + 0.13*salario_bps/200 + 0.02*fama/100`. Entre ofertas aceptadas gana el mayor atractivo; un empate favorece la oferta anterior y después el identificador lexicográfico. El sorteo usa una semilla privada de liga y el identificador de oferta; sus números quedan auditados. No se vuelve a sortear al reintentar el cierre.

Venta base: 85 % del VM; Venta inteligente mejora hasta 100 %. La implementación inicial no genera ofertas excepcionales superiores al VM. Deseados permite hasta cinco plazas y devolución posterior de hasta 2,5 % de VM, sin alterar el atractivo. La infelicidad cero fuerza venta al 85 % sin bonificaciones.

Un salario contractual de 200 bps equivale a 2 %. La reducción por investigación se limita a 150 bps y deja al menos 50 bps efectivos. Después se suma el recargo de calidad. El VM y cada coste se congelan al cerrar la convocatoria. No existe salario periódico fuera de la convocatoria. Los suplentes también cobran.

Calidad de casilla: base, Bronce, Plata y Oro; multiplicadores y recargos están en configuración. La bonificación adicional se limita a 25 % y la de casilla a 25 %. Puntos negativos y cero no se multiplican. La casilla vacía recibe -500 centésimas; un convocado sin minutos recibe la puntuación cero del proveedor. La política de entradas se congela y aplica una única vez.

El estadio liquida aforo, ocupación, precio y política; descuenta energía, agua, personal y mantenimiento creciente. LED reduce energía; aspersores, agua; focos de espectáculos, conciertos. El videomarcador ofrece cero, uno, dos o tres espacios, y su cuarto nivel añade comodidad. Merchandising depende de tienda, afición, fama y goles propios. Los patrocinios pagan al cierre diario, con fechas de contrato.

La televisión reparte un fondo de 1,5 M€ por participante y jornada: mitad igualitaria, mitad ponderada en orden inverso de la clasificación previa. Un ajuste de céntimos conserva exactamente el fondo. La financiación urgente devuelve el doble y la bancaria el 110 %; se cobran aunque causen saldo negativo. Mientras haya deuda pendiente o saldo negativo no se encadenan créditos.

La cantera cobra observación y, al completar, el VM completo del jugador descubierto. No regala un activo vendible ni garantiza fichaje si faltan fondos o plaza. Los préstamos de jugadores reservan la plaza del cedente hasta el retorno. Obras canceladas devuelven la mitad de lo pagado, nunca más. Los premios solo se reclaman una vez por evento.
