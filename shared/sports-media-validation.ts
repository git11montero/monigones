import { z } from 'zod';
import type { Player } from './types';
import { BRAND } from './brand';
export const MediaPackageSchema = z.object({
  season: z.string(),
  photos: z.array(
    z.object({
      playerId: z.string(),
      identity: z.string(),
      clubId: z.string(),
      season: z.string(),
      externalId: z.string().optional(),
      file: z.string().min(1),
      source: z.url().startsWith('https://'),
      author: z.string().min(2),
      license: z.enum(['CC0', 'CC-BY-2.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-SA-3.0']),
      licenseUrl: z.url().startsWith('https://creativecommons.org/'),
      verifiedAt: z.iso.date(),
      width: z.number().int().min(250),
      height: z.number().int().min(250),
      modified: z.boolean(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
});
export function validateMediaPackage(input: unknown, players: Player[]) {
  const pkg = MediaPackageSchema.parse(input);
  if (pkg.season !== BRAND.season) throw Error('Temporada incorrecta.');
  const ids = new Set<string>(),
    files = new Set<string>(),
    hashes = new Set<string>();
  for (const photo of pkg.photos) {
    const player = players.find((p) => p.id === photo.playerId);
    if (!player) throw Error(`ID desconocido: ${photo.playerId}`);
    if (player.simulated) throw Error(`Identidad ficticia: ${photo.playerId}`);
    if (player.name !== photo.identity)
      throw Error(`Identidad no coincide con el ID: ${photo.playerId}`);
    if (player.realClubId !== photo.clubId) throw Error(`Club no coincide: ${photo.playerId}`);
    if (photo.season !== pkg.season) throw Error('Temporada no coincide.');
    if (ids.has(photo.playerId) || files.has(photo.file) || hashes.has(photo.sha256))
      throw Error('Fotografía o identidad duplicada.');
    if (photo.verifiedAt > new Date().toISOString().slice(0, 10))
      throw Error('Verificación futura.');
    ids.add(photo.playerId);
    files.add(photo.file);
    hashes.add(photo.sha256);
  }
  return pkg;
}
