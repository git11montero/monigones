import { RULES } from './config.js';
import { formatMoney } from './money.js';
export const HELP = {
  resources: [
    'Recursos del club',
    'Tesorería, puntos de desarrollo y medallas se gastan en operaciones distintas. Fama, prestigio, suerte y satisfacción describen el club. Cada movimiento queda registrado en Finanzas. Ocultar los recursos es una preferencia visual: no modifica saldos ni costes.',
  ],
  money: [
    'Dinero y reservas',
    'El disponible es la tesorería menos tus ofertas secretas abiertas y las subastas que lideras. Reservar no es pagar: una retirada libera la reserva. Una compra, construcción o convocatoria sí genera un movimiento. Los importes de pantalla están en euros; el motor conserva céntimos enteros.',
  ],
  development: [
    'Puntos de desarrollo',
    `Se reciben ${RULES.dailyDevelopment} PD por día de juego y también mediante actividades y recompensas. Se consumen junto con dinero en edificios, instalaciones e investigaciones. Los PD no son euros y no pueden sustituirlos.`,
  ],
  medals: [
    'Medallas',
    'Son recompensas de actividades y eventos. Mejorar una casilla a Bronce consume 2 medallas, a Plata 4 y a Oro 6, además del dinero y los requisitos de investigación/entrenamiento. No se consumen de nuevo al seleccionar una calidad ya desbloqueada.',
  ],
  fame: [
    'Fama',
    'Ganar jornadas, fichar y ciertas actividades dan fama; vender y determinados resultados pueden restarla. El límite inicial es 10; las investigaciones pueden ampliarlo hasta 100. Cada punto reduce el rechazo de agentes libres en 0,05 puntos porcentuales, suma 0,15 a la ocupación del estadio y participa en los requisitos de patrocinadores y el merchandising. No añade puntos deportivos.',
  ],
  prestige: [
    'Prestigio',
    'Se obtiene en actividades y decisiones institucionales. El límite inicial es 50 y puede ampliarse mediante investigación hasta 100. Se requieren al menos 20 para determinadas decisiones institucionales. No aumenta directamente el marcador ni la aceptación de un fichaje.',
  ],
  luck: [
    'Suerte',
    'Se mantiene entre 0 y 100. Cada punto suma 0,02 puntos porcentuales a la fórmula de ocupación del estadio. No cambia la puntuación del futbolista ni garantiza ganar pujas, fichajes o rarezas de actividades.',
  ],
  fans: [
    'Satisfacción de la afición',
    'La satisfacción va de 0 a 100. Contratar jugadores del club favorito y determinadas actividades o conciertos pueden aumentarla; venderlos puede reducirla. Cada punto suma 0,2 a la ocupación y 300€ a la base del merchandising por jornada, antes de sus multiplicadores. No equivale a fama ni modifica los puntos fantasy.',
  ],
  value: [
    'Valor de mercado',
    'El VM es el valor del futbolista en el simulador y cambia con sus reglas de actualización. Es el mínimo de oferta por un agente libre y la base del salario de convocatoria. Identidad, club y posición son datos deportivos; VM, puntos, estados y contratos de esta demo son generados y no cotizaciones reales.',
  ],
  salary: [
    'Salario de convocatoria',
    `Se cobra una hora antes del primer partido por todos los titulares asignados y suplentes convocados, aunque no jueguen. El salario contractual habitual parte del 2% del VM; la investigación puede reducirlo hasta 1,5 puntos porcentuales, respetando el mínimo del 0,5%. La calidad añade 0 / 0,10 / 0,30 / 0,75 puntos porcentuales. Por ejemplo, un VM de ${formatMoney(100_000_000)} al 2% cuesta ${formatMoney(2_000_000)} en calidad Básico.`,
  ],
  bids: [
    'Pujas secretas',
    'La oferta mínima es el VM y solo puedes reservar tu dinero disponible. Cambiar una oferta recupera su reserva anterior para calcular tu nuevo límite. Puedes retirar una puja abierta antes del cierre. No se muestran las ofertas secretas de otros clubes. En el cierre se valida presupuesto, plazas, aceptación y adjudicación de forma atómica.',
  ],
  rejection: [
    'Probabilidad de rechazo',
    'La probabilidad parte del 50%. Baja al ofrecer más que el VM, mejorar el salario o tener fama, y queda limitada entre 2% y 50%. Ofrecer el VM con salario del 2% y fama 10 produce 49,5% de rechazo. Una oferta muy alta nunca garantiza la aceptación. El atractivo combina dinero, salario y fama para decidir entre ofertas aceptadas.',
  ],
  clauses: [
    'Clausulazos',
    'Requieren el módulo de Oficinas y alcanzar el día 50 de temporada. Se paga la cláusula contractual completa y se cambia el propietario sin negociación. No se permite con blindaje vigente, cesión, convocatoria congelada o plantilla sin plazas. El importe exacto aparece en la ficha; no se deduce de las pujas secretas.',
  ],
  shield: [
    'Blindajes',
    'El módulo de Oficinas permite proteger un contrato propio durante 15 días pagando el 50% del VM. Impide ejecutar su cláusula mientras dure. No modifica el sueldo, los puntos ni el propietario, y no se puede activar de nuevo si ya está vigente. Un jugador cedido no admite este blindaje.',
  ],
  loans: [
    'Cesiones y financiación',
    'La cesión de futbolistas requiere el módulo correspondiente y un acuerdo entre presidentes, dura de 1 a 3 jornadas y no admite jugador de intercambio. Conserva el contrato y retorna al club de origen al finalizar. La financiación institucional es distinta: cada oferta indica ingreso, devolución y jornada de vencimiento; no es dinero gratuito.',
  ],
  callup: [
    'Convocatoria',
    'Se guardan once casillas: un POR y diez jugadores de campo de la formación elegida, sin duplicados. Puedes dejar plazas vacías, pero cada una resta 5 puntos. La convocatoria se congela y cobra una hora antes del primer partido. Si el coste no puede pagarse, la jornada se invalida. Solo se convocan jugadores propios y de la demarcación de cada plaza.',
  ],
  bonuses: [
    'Bonificaciones deportivas',
    `La calidad de casilla añade ${RULES.qualityBonus.map((n) => `${n / 100}%`).join(' / ')} según Básico/Bronce/Plata/Oro. El bonus adicional de investigación y entrenador está limitado al 25%. Se aplican solo cuando la puntuación base es positiva: con base 10 y Bronce se obtienen 10,50 antes del bonus adicional. Los puntos negativos y cero no se multiplican.`,
  ],
  slots: [
    'Casillas persistentes',
    'Existen exactamente once casillas numeradas. La 1 es POR y las 2–11 siguen el orden defensas, medios y delanteros de cada dibujo. Su calidad y máximo desbloqueado pertenecen al número de casilla. Al pasar de 4-4-2 a 3-3-4, la casilla 5 deja de representar DEF y pasa a MED, conservando la misma mejora. Consultar otro dibujo en Entrenamiento no cambia tu alineación ni crea mejoras adicionales.',
  ],
  bench: [
    'Banquillo',
    'El nivel 0 no permite suplentes. El nivel 1 habilita una plaza y una entrada automática. Los siguientes niveles progresan hasta cuatro suplentes y cuatro entradas automáticas en el nivel 7. Solo se admite un suplente por demarcación y también paga convocatoria. Un jugador de plantilla que no hayas convocado no consume plaza de banquillo.',
  ],
  autoSubs: [
    'Cambios automáticos',
    'Cuando termina el encuentro del suplente, el motor intenta cubrir una casilla vacía o un titular de su misma demarcación con cero minutos. Respeta el cupo del banquillo, evita repetir jugadores y conserva la calidad de la casilla. Tener cupo no garantiza un relevo: necesita un suplente compatible y las condiciones del encuentro.',
  ],
  manualSubs: [
    'Cambios manuales',
    'Las investigaciones habilitan hasta dos por jornada. Solo durante una convocatoria válida y congelada: el titular debe haber terminado su encuentro y el suplente no debe haber empezado el suyo. Deben compartir demarcación. Se usa un convocado del banquillo, no cualquier jugador de plantilla, y se conserva la calidad de la plaza.',
  ],
  facilities: [
    'Instalaciones',
    'Cada instalación tiene un máximo y requisitos propios del estadio. Gradas aumentan aforo; Vestuarios aumentan plantilla; Banquillo añade suplentes; Césped desbloquea dibujos. Las mejoras cuestan dinero/PD y requieren una obra. Lee su efecto concreto: un nivel visual de edificio no implica una bonificación deportiva adicional.',
  ],
  research: [
    'Investigaciones',
    'Solo se investiga una tecnología cada vez. Cada nivel comprueba centro, dependencias, dinero y PD. El beneficio se aplica al finalizar el trabajo en el servidor, aunque cierres el juego. La vista muestra contribución real por nivel; los descuentos y bonus respetan sus topes. Una investigación no se pierde al cambiar de formación.',
  ],
  market: [
    'Mercado',
    'Se renueva a las 06:00 de Madrid y ofrece cinco agentes libres. VM y salarios se expresan en euros; las pujas abiertas reservan dinero. Se resuelven en el servidor aunque no haya jugadores conectados. Una foto o escudo no demuestra que una valoración deportiva sea real: los puntos y precios de la demo siguen siendo simulados.',
  ],
  sponsors: [
    'Patrocinios',
    'La marca exige una fama mínima y un espacio publicitario libre. Las duraciones permitidas son 7, 14 y 30 días. Se paga el alta indicada y se reciben ingresos diarios mientras está vigente, afectados por la investigación correspondiente. Los espacios de videomarcador requieren su instalación. No se puede ocupar dos veces el mismo espacio.',
  ],
  concerts: [
    'Conciertos',
    'Requieren su módulo y el nivel de estadio de la oferta. Solo hay un concierto activo por club. Pagas la organización, recibes el cambio de satisfacción/fama indicado y dura 14 días. Su ingreso se cobra por jornada, no por día; la iluminación de espectáculo añade un 5% por nivel. No confundas el ingreso estimado de dos jornadas con una garantía de calendario.',
  ],
  activities: [
    'Actividades',
    'Las ofertas se generan por día de juego. Solo una actividad puede quedar pendiente de cobrar. Se paga al iniciarla y la recompensa se reclama una vez cuando termina. El servidor valida duración y día: cambiar el reloj del teléfono no adelanta la recompensa. Coste, duración, rareza y recursos concretos se indican en cada oferta.',
  ],
  rarities: [
    'Rarezas',
    'Común, Poco común, Rara, Épica y Legendaria organizan las actividades. El catálogo usa pesos 55, 27, 13, 4 y 1 para su selección ponderada; no significan una promesa de recibir una legendaria cada cien días. La rareza no multiplica por sí sola el marcador: cada actividad define sus recompensas.',
  ],
  construction: [
    'Construcciones',
    'El presupuesto se cobra al comenzar y el trabajo termina según el reloj del servidor, sin necesitar el juego abierto. La sede limita los edificios y cada mejora tiene requisitos. Las investigaciones pueden reducir duración, con tope del 30%. Cancelar devuelve el reembolso mostrado en la confirmación; no devuelve automáticamente todos los recursos.',
  ],
  penalties: [
    'Penalizaciones',
    'Una plaza titular vacía resta 5 puntos; un convocado sin minutos puntúa cero. Una convocatoria inválida no obtiene puntos de jornada. Mantenimiento y devoluciones se liquidan con sus reglas. Un futbolista no convocado pierde felicidad y, al acumular tres ausencias, la pérdida aumenta; con felicidad cero abandona y el club recibe el 85% del VM.',
  ],
  rankings: [
    'Clasificación',
    'Se ordena por puntos fantasy acumulados, con desempate estable por identificador. Cada jornada aporta la suma liquidada de sus once casillas, con bonus positivos y penalizaciones. El reparto televisivo combina una mitad igualitaria y otra ponderada por la clasificación previa a la liquidación, favoreciendo las posiciones inferiores. Consultar puntos provisionales no equivale al informe final.',
  ],
  competition: [
    'Competiciones',
    'La temporada simulada tiene 38 jornadas. El calendario agrupa partidos de los veinte clubes reales; sus horarios y puntuaciones son los del proveedor de demostración. La liga Fantasy se disputa entre presidentes y mantiene su propio histórico, trofeos y clasificación. No se importan resultados ni puntos de las capturas proporcionadas.',
  ],
  happiness: [
    'Felicidad contractual',
    'Se limita a 0–100. En una convocatoria válida, un convocado suma 5 más el efecto de investigación, y un titular añade 2. No convocarlo resta 4; a partir de tres ausencias consecutivas resta 5 adicionales. Alcanzar cero provoca su salida por el 85% del VM. Convocar también tiene coste, incluso desde el banquillo.',
  ],
  offices: [
    'Oficinas',
    'Cada módulo se desbloquea por separado. Algunos exigen una investigación o un día de temporada además del pago. El nivel visual de Oficinas no abre todos los módulos. Cada bloque indica estado, requisito y destino; los módulos de cláusulas, cesiones, blindajes y conciertos mantienen sus validaciones en el servidor.',
  ],
  chat: [
    'Chat de liga',
    'Los mensajes pertenecen únicamente a tu liga y usan el mismo historial en el periódico, la página Chat y la cabecera. El borrador se conserva en esta sesión del dispositivo. Abrir otra liga no comparte mensajes ni borradores. El globo representa mensajes sin leer; se reconocen los mostrados, no mensajes futuros. El administrador puede moderar.',
  ],
  formations: [
    'Formaciones y césped',
    'Los dibujos disponibles se acumulan por nivel de Césped. Todos tienen un portero y diez jugadores de campo. 3-3-4 y 4-2-4 requieren nivel 4; 3-4-4 no es válida porque añadiría un duodécimo titular. Cambiar dibujo conserva jugadores compatibles y las once mejoras, pero puede dejar plazas por asignar. Previsualizar no aplica un cambio.',
  ],
} as const;
export type HelpTopic = keyof typeof HELP;
export function helpTopic(label: string): HelpTopic | undefined {
  const text = label.toLocaleLowerCase('es');
  const rules: [RegExp, HelpTopic][] = [
    [/suerte/, 'luck'],
    [/prestigio/, 'prestige'],
    [/fama/, 'fame'],
    [/felicidad/, 'happiness'],
    [/afición|satisfacción|nadie juega/, 'fans'],
    [/medallas/, 'medals'],
    [/desarrollo/, 'development'],
    [/salario/, 'salary'],
    [/rechazo/, 'rejection'],
    [/cláusula|clausulazo/, 'clauses'],
    [/blindaje/, 'shield'],
    [/cesion|cesión|financiación|palanca/, 'loans'],
    [/banquillo|siempre preparados/, 'bench'],
    [/cambios automáticos/, 'autoSubs'],
    [/cambios manuales/, 'manualSubs'],
    [/entrenamiento|casilla|calidad/, 'slots'],
    [/bonus|bonificaci/, 'bonuses'],
    [/investiga|árbol/, 'research'],
    [/patrocin|juntos, más/, 'sponsors'],
    [/concierto|noches para/, 'concerts'],
    [/actividad|hoy dejas/, 'activities'],
    [/rareza/, 'rarities'],
    [/constru|obra|siguiente paso/, 'construction'],
    [/instalaci|estadio|césped|cada detalle/, 'facilities'],
    [/penaliz/, 'penalties'],
    [/clasifica|liga está|clasificación/, 'rankings'],
    [/competici|jornada|evento/, 'competition'],
    [/convoc|alineaci|tu once|tu equipo/, 'callup'],
    [/formaci|táctic/, 'formations'],
    [/puja|draft|oferta|primera gran/, 'bids'],
    [/mercado|próxima gran/, 'market'],
    [/valor de mercado/, 'value'],
    [/oficina|gestionado|módulo/, 'offices'],
    [/tesorer|finanza|dinero|salud de tu club|movimiento/, 'money'],
    [/chat|vestuario/, 'chat'],
    [/recurso|club que estás/, 'resources'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1];
}
