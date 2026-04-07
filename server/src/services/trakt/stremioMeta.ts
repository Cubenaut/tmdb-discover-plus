import type { TraktMovie, TraktShow } from './types.ts';
import type { StremioMetaPreview, StremioLink } from '../../types/stremio.ts';
import type { ContentType } from '../../types/common.ts';
import type { PosterOptions } from '../../types/config.ts';
import { metahubUrl } from '../../constants.ts';
import { generateSlug } from '../common/stremioHelpers.ts';
import { generatePosterUrl, isValidPosterConfig } from '../posterService.ts';

export function traktToStremioMeta(
  item: TraktMovie | TraktShow,
  type: ContentType,
  posterOptions: PosterOptions | null = null
): StremioMetaPreview | null {
  const imdbId = item.ids.imdb;
  if (!imdbId) return null;

  const tmdbId = item.ids.tmdb ?? 0;

  let poster = metahubUrl('poster', imdbId);
  if (posterOptions && isValidPosterConfig(posterOptions)) {
    const enhancedPoster = generatePosterUrl({
      ...posterOptions,
      tmdbId,
      type,
      imdbId,
    });
    if (enhancedPoster) {
      poster = enhancedPoster;
    }
  }

  const background = metahubUrl('background', imdbId);

  const links: StremioLink[] = [];
  if (imdbId) {
    links.push({
      name: item.rating ? item.rating.toFixed(1) : 'IMDb',
      category: 'imdb',
      url: `https://imdb.com/title/${imdbId}`,
    });
  }

  return {
    id: imdbId,
    tmdbId,
    imdbId,
    imdb_id: imdbId,
    traktSlug: item.ids.slug || null,
    type,
    name: item.title,
    slug: generateSlug(type, item.title, imdbId),
    poster,
    posterShape: 'poster',
    background,
    fanart: background,
    landscapePoster: background,
    genres: item.genres || [],
    description: item.overview || '',
    releaseInfo: item.year ? String(item.year) : '',
    imdbRating: item.rating ? item.rating.toFixed(1) : undefined,
    links: links.length > 0 ? links : undefined,
    behaviorHints: {},
  };
}

export function batchConvertToStremioMeta(
  items: (TraktMovie | TraktShow)[],
  type: ContentType,
  posterOptions: PosterOptions | null = null
): StremioMetaPreview[] {
  const results: StremioMetaPreview[] = [];
  for (const item of items) {
    const meta = traktToStremioMeta(item, type, posterOptions);
    if (meta) results.push(meta);
  }
  return results;
}
