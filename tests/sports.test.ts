import { describe, it, expect } from 'vitest';
import { ImportSportsProvider, MockSportsProvider, roster, REAL_CLUBS } from '../shared/sports';
describe('proveedores deportivos', () => {
  it('incluye los veinte clubes y quinientos futbolistas con procedencia', () => {
    const players = roster(Date.now());
    expect(REAL_CLUBS).toHaveLength(20);
    expect(players).toHaveLength(500);
    expect(new Set(players.map((p) => p.id)).size).toBe(500);
    expect(players.filter((p) => !p.simulated).every((p) => p.source && p.verifiedAt)).toBe(true);
    expect(players.filter((p) => !p.simulated).length).toBeGreaterThan(60);
  });
  it('normaliza importaciones y rechaza duplicados o clubes desconocidos', async () => {
    const input = {
      version: 'test',
      players: [
        {
          id: 'x',
          name: '  Un jugador ',
          realClubId: 'madrid',
          position: 'MED',
          value: 100000,
          simulated: true,
        },
      ],
    };
    const result = await new ImportSportsProvider(input).getPlayers();
    expect(result[0].name).toBe('Un jugador');
    await expect(
      new ImportSportsProvider({
        ...input,
        players: [...input.players, ...input.players],
      }).getPlayers(),
    ).rejects.toThrow();
    await expect(
      new ImportSportsProvider({
        ...input,
        players: [{ ...input.players[0], realClubId: 'inventado' }],
      }).getPlayers(),
    ).rejects.toThrow();
  });
  it('importa CSV validado y no inventa fuentes para identidades reales', async () => {
    const p = ImportSportsProvider.fromCSV(
      'id,name,realClubId,position,value,simulated,source\nx,Prueba Uno,madrid,MED,100000,true,',
    );
    expect(await p.getPlayers()).toHaveLength(1);
    await expect(
      new ImportSportsProvider({
        version: 'test',
        players: [
          {
            id: 'real',
            name: 'Nombre real',
            realClubId: 'madrid',
            position: 'DEL',
            value: 100000,
            simulated: false,
          },
        ],
      }).getPlayers(),
    ).rejects.toThrow();
  });
  it('proveedor mock devuelve calendario de diez partidos y puntos estables', async () => {
    const provider = new MockSportsProvider();
    const players = await provider.getPlayers();
    expect(await provider.getCalendar(1, Date.now())).toHaveLength(10);
    expect(await provider.getScores(players, 1)).toEqual(await provider.getScores(players, 1));
    expect(await provider.getCoaches()).toHaveLength(4);
  });
});
