import type { Club } from '../../shared/types';
import { RESEARCH } from '../../shared/config';
import { facilityLimit } from '../../shared/engine';
import { shortMoney } from '../../shared/math';
function benefits(id: string, c: Club): [string, string][] {
  const level = c.buildings[id] || 1;
  if (id === 'hq') return [['Límite de edificios', `Nivel ${level}`]];
  if (id === 'stadium')
    return [
      ['Límite de gradas', `Nivel ${facilityLimit(c, 'stands')}`],
      ['Límite de vestuarios', `Nivel ${facilityLimit(c, 'locker')}`],
      ['Límite de banquillo', `Nivel ${facilityLimit(c, 'bench')}`],
    ];
  if (id === 'research')
    return [
      [
        'Tecnologías al alcance del centro',
        String(RESEARCH.filter((r) => r.buildingLevel <= level).length),
      ],
    ];
  if (id === 'training')
    return [
      ['Calidad máxima habilitable', ['Básico', 'Bronce', 'Plata', 'Oro'][Math.min(3, level)]],
    ];
  if (id === 'shop')
    return [['Base de merchandising por jornada', shortMoney(level * 20000 * 100)]];
  return [
    ['Acceso al departamento', 'Operativo'],
    ['Evolución arquitectónica', `Etapa ${level}/5`],
  ];
}
export function BuildingBenefits({ id, club, next }: { id: string; club: Club; next: number }) {
  const current = benefits(id, club),
    future = benefits(id, { ...club, buildings: { ...club.buildings, [id]: next } });
  return (
    <div className="benefit-comparison">
      <div className="definition-row">
        <span>Beneficio</span>
        <b>Actual → Nv. {next}</b>
      </div>
      {current.map(([name, value], i) => (
        <div className="definition-row" key={name}>
          <span>{name}</span>
          <strong>
            {value} → {future[i][1]}
          </strong>
        </div>
      ))}
      {!['hq', 'stadium', 'research', 'training', 'shop'].includes(id) && (
        <p className="hint">
          Este nivel evoluciona el edificio. Las reglas actuales no le asignan un multiplicador
          pasivo adicional; los acuerdos y decisiones se gestionan dentro del departamento.
        </p>
      )}
    </div>
  );
}
