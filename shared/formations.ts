import type { Position, Selection } from './types.js';
export interface Formation {
  id: string;
  pitch: number;
  /** Defensive line first; repeated MED rows retain the engine's four demarcations. */
  lines: { position: Position; count: number }[];
  positions: Position[];
}
function formation(id: string, pitch: number): Formation {
  const counts = id.split('-').map(Number);
  const lines = counts.map((count, index) => ({
    position: (index === 0 ? 'DEF' : index === counts.length - 1 ? 'DEL' : 'MED') as Position,
    count,
  }));
  const positions: Position[] = [
    'POR',
    ...lines.flatMap((line) => Array<Position>(line.count).fill(line.position)),
  ];
  if (positions.length !== 11) throw Error(`Formación inválida: ${id}`);
  return { id, pitch, lines, positions };
}
export const FORMATION_CATALOG = [
  formation('4-4-2', 0),
  formation('4-3-3', 0),
  formation('4-5-1', 0),
  formation('3-5-2', 1),
  formation('4-2-3-1', 1),
  formation('5-4-1', 1),
  formation('3-4-3', 2),
  formation('4-1-4-1', 2),
  formation('5-3-2', 2),
  formation('4-3-2-1', 3),
  formation('3-6-1', 3),
  formation('5-2-3', 3),
  formation('4-2-4', 4),
  formation('3-3-4', 4),
];
// 3-4-4 is deliberately absent: its eleven outfield players would make twelve starters.
export const FORMATIONS: Record<string, Position[]> = Object.fromEntries(
  FORMATION_CATALOG.map((f) => [f.id, f.positions]),
);
export function formationAllowed(id: string, pitch: number) {
  const entry = FORMATION_CATALOG.find((f) => f.id === id);
  return !!entry && entry.pitch <= pitch;
}
export function selectionFormation(selection: Pick<Selection, 'starters' | 'formation'>) {
  const positions = selection.starters.map((slot) => slot.position).join(',');
  const matches = (f: Formation) => f.positions.join(',') === positions;
  return (
    FORMATION_CATALOG.find((f) => f.id === selection.formation && matches(f)) ||
    FORMATION_CATALOG.find(matches)
  );
}
export function formationRows(f: Formation) {
  let offset = 1;
  const rows = f.lines.map((line) => {
    const indexes = Array.from({ length: line.count }, (_, i) => offset + i);
    offset += line.count;
    return indexes;
  });
  return [...rows.reverse(), [0]];
}
