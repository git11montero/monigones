# Actividades y equilibrio — Monigones v0.3

## Regla implementada

| Actividades cobradas del día          | Penalización al cerrar el día    |
| ------------------------------------- | -------------------------------- |
| 0, sin actividad pendiente de ese día | −1 fama                          |
| 1                                     | Ninguna                          |
| 2                                     | Ninguna                          |
| 3                                     | Ninguna                          |
| 0, con actividad pendiente de ese día | Decisión aplazada hasta su cobro |

Se exige terminar y recoger manualmente. No se conceden premios al iniciar, al vencer el contador o al cambiar de día. Solo puede existir una actividad sin cobrar. El servidor conserva la definición y los tiempos de inicio/fin: el reloj del dispositivo no concede autoridad.

El cierre se realiza a las **06:00 de Europe/Madrid**, incluyendo cambios de horario. `activityDays` conserva la contabilidad por día de inicio, separada de los IDs de propuestas vigentes. Una actividad iniciada a las 05:50 que termina después de las 06:00 conserva su coste, duración y recompensa. El cierre registra el pendiente y no resta fama prematuramente. Al cobrar incrementa una sola vez el día anterior; no consume una propuesta del día nuevo. Un segundo cobro se rechaza antes de modificar recursos. SQLite serializa los comandos y conserva las claves de idempotencia.

Las partidas v0.2 sin `activityDays` se inicializan a partir de `dailyDone` y del historial de cobros. La contabilidad privada no se entrega a otros presidentes. No se reescribe el pasado ni se devuelven penalizaciones históricas de v0.2.

Una recompensa terminada sigue pendiente hasta que el usuario la recoge, conforme a la regla anterior. Si se deja pendiente varios días, solo se aplaza la decisión de **su día de origen**: los días siguientes sin actividad pierden fama normalmente. No hay expiración ni cobro automático nuevo. El propio estado impide iniciar otra mientras siga pendiente.

## Duración y probabilidades conservadas

| Rareza     | Duración admitida | Peso de propuesta |
| ---------- | ----------------- | ----------------- |
| Común      | 30–60 min         | 55                |
| Poco común | 1–2 h             | 27                |
| Rara       | 2–4 h             | 13                |
| Épica      | 4–6 h             | 4                 |
| Legendaria | 6–8 h             | 1                 |

Se conservan las 20 actividades, costes, recompensas y requisitos de v0.2. Las tres ofertas se calculan de forma determinista por liga, día y posición, sin repetir IDs. Recargar, reiniciar sesión o cambiar el reloj local no permite buscar propuestas mejores; no existe acción de refresco pagado o gratuito.

## Revisión de recompensas

La actividad legendaria dura 8 horas y cuesta **350.000 €**; otorga 8 prestigio, 200 PD y 5 fama. Su rendimiento secundario es 25 PD/h. Las actividades comunes de desarrollo incluyen 40–60 PD en 30 minutos (80–120 PD/h), por lo que la legendaria no domina el desarrollo por hora; además requiere inmovilizar la única actividad activa y pagar un coste significativo. Prestigio, fama y afición están sujetos a sus límites previos. No se pueden sumar esos recursos como si fueran euros ni atribuirles una equivalencia ficticia.

Ejemplos del resto del catálogo: archivo gratuito, 100 PD en 2 h; encuentro de colaboradores, 50.000 € de coste y 120.000 € de ingreso en 4 h (70.000 € netos); fotos con patrocinadores, 15.000 € de coste y 40.000 € de ingreso en 90 min (25.000 € netos y 1 fama); gala, 150.000 € por 5 prestigio y 4 fama en 5 h. Son decisiones diferentes por recurso y disponibilidad.

**Decisión:** conservar todos los premios, como pide el encargo, y eliminar la obligación de hacer tres actividades. Las conexiones adicionales permiten recoger otras propuestas limitadas, pero no evitan penalizaciones adicionales ni generan propuestas ilimitadas. No se ha cambiado el mercado, VM, salarios, investigación, patrocinios, conciertos ni reglas deportivas. La ausencia de telemetría de jugadores reales impide afirmar que el balance de larga duración esté optimizado; no se han inventado métricas de retención.

## Verificación

Pruebas en `tests/v03.test.ts`: 0/1/2/3, compatibilidad con partidas anteriores, cierre con pendiente, propuesta nueva, ausencia de cobro automático, cobro único, días posteriores sin actividad, horario de invierno y privacidad. `tests/v02.test.ts` conserva duraciones, probabilidades, costes, premios, concurrencia e idempotencia. El navegador prueba iniciar/recoger, reloj manipulado y bloqueo de repetición. Resultados y límites en [MONIGONES_V03_DELIVERY.md](MONIGONES_V03_DELIVERY.md).
