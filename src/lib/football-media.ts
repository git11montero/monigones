import { useQuery } from '@tanstack/react-query';
import { request } from './api';
import type { MediaStatus } from '../../server/football-media';
export function useFootballCatalog() {
  return useQuery({
    queryKey: ['football-media'],
    queryFn: async () => {
      try {
        const result = await request<Record<string, MediaStatus>>('/api/football-assets');
        try {
          localStorage.setItem('monigones-football-media-v3', JSON.stringify(result));
        } catch {
          /* Full cache does not invalidate images. */
        }
        return result;
      } catch (error) {
        const saved = localStorage.getItem('monigones-football-media-v3');
        if (saved) return JSON.parse(saved) as Record<string, MediaStatus>;
        throw error;
      }
    },
    refetchInterval: 5000,
    staleTime: 4000,
    retry: 1,
  });
}
export function useFootballMedia(path: string) {
  const query = useFootballCatalog();
  const info = query.data?.[path];
  return { src: info ? `${path}?v=${info.version}` : path, kind: info?.kind };
}
