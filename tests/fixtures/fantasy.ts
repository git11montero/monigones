import fantasy from '../../data/demo-fantasy-v06.json';
import { roster } from '../../shared/sports';
const at = Date.parse('2026-10-25T10:00:00Z');
export function completedTestFantasy() {
  const fixture = structuredClone(fantasy);
  // Deliberate test-only identity. This never changes the unresolved production source.
  const used = new Set(
    fixture.teams.flatMap((t) => [...t.starters, ...t.bench].map((p) => p.playerId)),
  );
  const p = roster(at).find((p) => p.position === 'DEL' && !used.has(p.id))!;
  fixture.teams[1].starters[0] = {
    reference: 'SOLO PRUEBA',
    playerId: p.id,
    realClubId: p.realClubId,
    fullName: p.fullName!,
    position: p.position,
  };
  return fixture;
}
