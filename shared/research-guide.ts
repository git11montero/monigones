import { RESEARCH, RULES, euro } from './config';
import { effects } from './engine';
import { roundRatio, shortMoney } from './math';
import type { Club, Effect, ResearchDef } from './types';
export { RESEARCH_STORIES } from './research-stories';
export const EFFECT_LABELS: Record<string, string> = {
  salary: 'Reducción salarial',
  sale: 'Mejora de venta sobre el VM',
  sport: 'Bonificación de puntos positivos',
  sponsor: 'Patrocinios y merchandising',
  construction: 'Reducción del tiempo de proyectos nuevos',
  secondQueue: 'Colas simultáneas de obra',
  manual: 'Cambios manuales por jornada',
  quality: 'Calidad máxima disponible',
  fameCap: 'Límite de fama',
  prestigeCap: 'Límite de prestigio',
  luck: 'Suerte al completar',
  fans: 'Satisfacción al completar',
  happiness: 'Felicidad extra por convocatoria',
  maintenance: 'Reducción del mantenimiento',
  wish: 'Plazas de deseados',
  wishDiscount: 'Devolución del VM de deseados',
  concerts: 'Acceso al módulo Conciertos',
  custom: 'Personalización avanzada pendiente',
  kits: 'Equipaciones especiales pendientes',
};
export const EFFECT_CAPS: Partial<Record<keyof Effect, number>> = {
  salary: 150,
  sale: 1500,
  sport: 2500,
  construction: 3000,
  maintenance: 3000,
  manual: 2,
  wish: 5,
  wishDiscount: 250,
  quality: 3,
  secondQueue: 1,
  fameCap: 90,
  prestigeCap: 50,
};
export function effectValue(key: string, value: number): string {
  if (['salary'].includes(key))
    return `${(value / 100).toLocaleString('es-ES')} puntos porcentuales`;
  if (['sale', 'sport', 'sponsor', 'construction', 'maintenance', 'wishDiscount'].includes(key))
    return `${(value / 100).toLocaleString('es-ES')} %`;
  if (key === 'fameCap') return String(Math.min(100, 10 + value));
  if (key === 'prestigeCap') return String(Math.min(100, 50 + value));
  if (key === 'secondQueue') return String(value ? 2 : 1);
  if (key === 'quality') return ['Base', 'Bronce', 'Plata', 'Oro'][Math.min(3, value)];
  if (['custom', 'kits'].includes(key)) return 'Pendiente de implementar';
  if (key === 'concerts') return value ? 'Módulo habilitado' : 'Módulo bloqueado';
  return String(value);
}
export function effectContribution(key: string, value: number): string {
  if (['fameCap', 'prestigeCap'].includes(key)) return `+${value} al límite`;
  if (key === 'secondQueue') return value ? 'Una cola extra' : 'Sin cola extra';
  if (['custom', 'kits'].includes(key)) return 'Pendiente de implementar';
  if (key === 'concerts') return value ? 'Habilita el módulo' : 'Sin desbloqueo';
  if (key === 'quality') return `Nivel ${value}`;
  return effectValue(key, value);
}
export function researchDetails(c: Club, r: ResearchDef) {
  const level = c.research[r.id] || 0,
    nextClub = { ...c, research: { ...c.research, [r.id]: Math.min(r.maxLevel, level + 1) } };
  const before = effects(c),
    after = effects(nextClub);
  const entries = Object.entries(r.effects).map(([k, v]) => {
    const key = k as keyof Effect,
      cap = EFFECT_CAPS[key];
    const limited = (x: number) => Math.min(cap ?? Infinity, x);
    const once = key === 'fans' || key === 'luck',
      current = once ? c.resources[key] : limited(before[key]),
      next = once
        ? Math.min(100, current + (level < r.maxLevel ? v || 0 : 0))
        : limited(after[key]);
    return {
      key,
      label: EFFECT_LABELS[key],
      current: effectValue(key, current),
      next: effectValue(key, next),
      contribution: effectContribution(key, (v || 0) * level),
      perLevel: effectContribution(key, v || 0),
      cap: cap === undefined ? 'Sin límite global adicional' : effectValue(key, cap),
    };
  });
  const salary = (ef: Required<Effect>) =>
    roundRatio(euro(10000000), Math.max(RULES.minSalary, 200 - ef.salary));
  const example = r.effects.salary
    ? `Un futbolista con VM de 10 M€ y salario del 2 %, en casilla Base, cuesta ${shortMoney(salary(before))} por convocatoria ahora y ${shortMoney(salary(after))} después. Se respeta el salario mínimo del ${RULES.minSalary / 100} %.`
    : r.effects.sport
      ? `Sobre 10 puntos positivos, la bonificación adicional conjunta pasa de ${(10 * before.sport) / 10000} a ${(10 * after.sport) / 10000} puntos, antes del redondeo final. Los puntos negativos no se multiplican.`
      : r.effects.sale
        ? `Con VM de 10 M€, vender al mercado pasa de ${shortMoney(roundRatio(euro(10000000), 8500 + before.sale))} a ${shortMoney(roundRatio(euro(10000000), 8500 + after.sale))}.`
        : r.effects.fameCap
          ? `El club puede conservar ${Math.min(100, 10 + before.fameCap)} de fama ahora y ${Math.min(100, 10 + after.fameCap)} después. No aumenta la recompensa de la firma de autógrafos ni la fama de otras actividades.`
          : r.effects.construction
            ? `Un proyecto de 10 horas base pasaría de ${10 * (1 - before.construction / 10000)} a ${10 * (1 - after.construction / 10000)} horas. Los proyectos ya iniciados conservan su fecha.`
            : r.effects.maintenance
              ? `Sobre 100.000 € de mantenimiento general base, pagarías ${shortMoney(roundRatio(euro(100000), 10000 - Math.min(3000, before.maintenance)))} ahora y ${shortMoney(roundRatio(euro(100000), 10000 - Math.min(3000, after.maintenance)))} después.`
              : r.effects.quality
                ? `Bronce: +${RULES.qualityBonus[1] / 100} % de puntos y +${RULES.qualitySalary[1] / 100} pp de salario; Plata: +${RULES.qualityBonus[2] / 100} % y +${RULES.qualitySalary[2] / 100} pp; Oro: +${RULES.qualityBonus[3] / 100} % y +${RULES.qualitySalary[3] / 100} pp. La compra de cada casilla se realiza en Plantilla.`
                : undefined;
  return {
    level,
    entries,
    example,
    pending: ['identity', 'kits'].includes(r.id),
    unlocks: RESEARCH.filter((x) => x.requires.includes(r.id)),
  };
}
