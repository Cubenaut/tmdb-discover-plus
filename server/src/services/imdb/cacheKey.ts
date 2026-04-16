import crypto from 'crypto';
import { stableStringify } from '../../utils/stableStringify.ts';
import type { ContentType } from '../../types/index.ts';

export function buildPosterIntegrationScope(
  posterService: string | null | undefined,
  posterApiKey: string | null | undefined
): string {
  const service = posterService || 'none';
  if (!posterApiKey) return `${service}:none`;

  const keyHash = crypto
    .createHash('sha256')
    .update(`${service}:${posterApiKey}`)
    .digest('hex')
    .slice(0, 16);
  return `${service}:${keyHash}`;
}

export function buildImdbEnrichmentCacheKey(
  type: ContentType,
  listType: string,
  filters: Record<string, unknown>,
  searchParams: Record<string, unknown> | null,
  skip: number,
  posterIntegrationScope: string,
  genre: string
): string {
  const genreSlug =
    genre && genre !== 'All' ? genre.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  if (listType === 'top250' || listType === 'popular') {
    return `catalog-imdb:${type}:${listType}:${skip}:${posterIntegrationScope}`;
  }
  if (listType === 'imdb_list' && filters.imdbListId) {
    const listId = String(filters.imdbListId).slice(0, 40);
    return `catalog-imdb:imdb_list:${listId}:${skip}:${posterIntegrationScope}`;
  }
  const filterHash = crypto
    .createHash('sha256')
    .update(stableStringify(searchParams))
    .digest('hex')
    .slice(0, 20);
  return `catalog-imdb:${type}:discover:${filterHash}:${skip}:${genreSlug}:${posterIntegrationScope}`;
}
