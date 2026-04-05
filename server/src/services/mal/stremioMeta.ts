import { getEntryByMalId, malIdToStremioId } from '../animeIdMap/index.ts';
import type { MalAnime } from './types.ts';
import type { StremioMetaPreview } from '../../types/stremio.ts';
import type { StremioLink } from '../../types/stremio.ts';
import type { ContentType } from '../../types/common.ts';
import { generateSlug } from '../common/stremioHelpers.ts';

export function malToStremioMeta(anime: MalAnime, type: ContentType): StremioMetaPreview | null {
  const mappedStremioId = malIdToStremioId(anime.id);
  const stremioId = mappedStremioId || `mal:${anime.id}`;

  const mapEntry = getEntryByMalId(anime.id);
  const imdbId = mapEntry?.imdb_id || (stremioId.startsWith('tt') ? stremioId : null);
  const primaryId = imdbId || stremioId;
  const tmdbId = mapEntry?.themoviedb_id ?? 0;

  const poster = anime.main_picture?.large || anime.main_picture?.medium || null;
  const title = anime.alternative_titles?.en || anime.title;
  const genres = anime.genres?.map((g) => g.name) || [];

  const links: StremioLink[] = [];
  if (anime.studios) {
    for (const studio of anime.studios) {
      links.push({
        name: studio.name,
        category: 'Studios',
        url: `https://myanimelist.net/anime/producer/${studio.id}`,
      });
    }
  }

  const releaseInfo: string[] = [];
  if (anime.start_season) {
    releaseInfo.push(String(anime.start_season.year));
    releaseInfo.push(anime.start_season.season);
  } else if (anime.start_date) {
    releaseInfo.push(anime.start_date.split('-')[0]);
  }

  return {
    id: primaryId,
    tmdbId,
    imdbId,
    imdb_id: imdbId,
    type,
    name: title,
    slug: generateSlug(type, title, primaryId),
    poster: poster,
    posterShape: 'poster',
    background: null,
    fanart: null,
    landscapePoster: null,
    description: anime.synopsis || '',
    genres,
    links: links.length > 0 ? links : undefined,
    releaseInfo: releaseInfo.join(' '),
    imdbRating: anime.mean ? anime.mean.toFixed(1) : undefined,
    behaviorHints: {},
  };
}

export function batchConvertToStremioMeta(
  animeList: MalAnime[],
  type: ContentType
): StremioMetaPreview[] {
  const results: StremioMetaPreview[] = [];
  for (const anime of animeList) {
    const meta = malToStremioMeta(anime, type);
    if (meta) results.push(meta);
  }
  return results;
}
