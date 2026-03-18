import { createLogger } from '../utils/logger.ts';
import { config } from '../config.ts';
import * as tmdb from '../services/tmdb/index.ts';
import * as imdb from '../services/imdb/index.ts';
import { getTmdbThrottle } from './tmdbThrottle.ts';
import { getCache } from '../services/cache/index.ts';
import { logSwallowedError } from '../utils/helpers.ts';
import { CACHE_TTLS, DISPLAY } from '../constants.ts';
import type { ContentType } from '../types/index.ts';

const log = createLogger('CacheWarmer');
const IMDB_PAGE_SIZE = DISPLAY.IMDB_PAGE_SIZE;

export async function warmEssentialCaches(
  apiKey: string | null
): Promise<{ warmed: number; failed: number; skipped?: boolean; elapsedMs?: number }> {
  if (!apiKey) {
    log.info('No default TMDB API key configured, skipping cache warming');
    return { warmed: 0, failed: 0, skipped: true };
  }

  const startTime = Date.now();
  log.info('Starting essential cache warming...');

  const tasks: { name: string; fn: () => Promise<unknown> }[] = [
    { name: 'movie_genres', fn: () => tmdb.getGenres(apiKey, 'movie') },
    { name: 'tv_genres', fn: () => tmdb.getGenres(apiKey, 'tv') },
    { name: 'languages', fn: () => tmdb.getLanguages(apiKey) },
    { name: 'countries', fn: () => tmdb.getCountries(apiKey) },
    { name: 'movie_certifications', fn: () => tmdb.getCertifications(apiKey, 'movie') },
    { name: 'tv_certifications', fn: () => tmdb.getCertifications(apiKey, 'tv') },
    { name: 'watch_regions', fn: () => tmdb.getWatchRegions(apiKey) },
  ];

  const regions = config.cache.warmRegions;
  for (const region of regions) {
    tasks.push({
      name: `watch_providers_movie_${region}`,
      fn: () => tmdb.getWatchProviders(apiKey, 'movie', region),
    });
    tasks.push({
      name: `watch_providers_tv_${region}`,
      fn: () => tmdb.getWatchProviders(apiKey, 'tv', region),
    });
  }

  const results = await Promise.allSettled(tasks.map((t) => t.fn()));

  let warmed = 0;
  let failed = 0;

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      warmed++;
      log.debug(`Warmed: ${tasks[i].name}`);
    } else {
      failed++;
      log.warn(`Failed to warm: ${tasks[i].name}`, { error: result.reason?.message });
    }
  });

  if (imdb.isImdbApiEnabled()) {
    const imdbTasks = [
      { name: 'imdb_genres', fn: () => imdb.getGenres() },
      { name: 'imdb_top250_movie', fn: () => imdb.getTopRanking('movie') },
      { name: 'imdb_top250_series', fn: () => imdb.getTopRanking('series') },
      { name: 'imdb_popular_movie', fn: () => imdb.getPopular('movie') },
      { name: 'imdb_popular_series', fn: () => imdb.getPopular('series') },
    ];

    const imdbResults = await Promise.allSettled(imdbTasks.map((t) => t.fn()));
    imdbResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        warmed++;
        log.debug(`Warmed: ${imdbTasks[i].name}`);
      } else {
        failed++;
        log.warn(`Failed to warm: ${imdbTasks[i].name}`, { error: result.reason?.message });
      }
    });
  }

  const elapsed = Date.now() - startTime;
  log.info('Cache warming complete', { warmed, failed, elapsedMs: elapsed });

  getTmdbThrottle().endWarmup();

  void warmTrendingMeta(apiKey).catch((err) =>
    log.warn('Trending meta warming failed (non-critical)', { error: (err as Error).message })
  );

  void warmImdbEnrichment(apiKey).catch((err) =>
    log.warn('IMDb enrichment warming failed (non-critical)', { error: (err as Error).message })
  );

  return { warmed, failed, elapsedMs: elapsed };
}

async function batchWithConcurrency(
  tasks: (() => Promise<unknown>)[],
  concurrency: number
): Promise<void> {
  for (let i = 0; i < tasks.length; i += concurrency) {
    await Promise.allSettled(tasks.slice(i, i + concurrency).map((fn) => fn()));
  }
}

export async function warmTrendingMeta(
  apiKey: string | null
): Promise<{ warmed: number; skipped: number }> {
  if (!apiKey) return { warmed: 0, skipped: 0 };

  const PAGES = 5;
  const CONCURRENCY = 3;
  const types: ContentType[] = ['movie', 'series'];

  let warmed = 0;
  let skipped = 0;

  for (const type of types) {
    for (let page = 1; page <= PAGES; page++) {
      let pageResult: { results?: unknown[] } | null = null;
      try {
        pageResult = (await tmdb.fetchSpecialList(apiKey, 'trending', type, { page })) as {
          results?: unknown[];
        } | null;
      } catch (err) {
        log.debug('Trending fetch failed during meta warming', {
          type,
          page,
          error: (err as Error).message,
        });
        continue;
      }

      const items = (pageResult?.results || []) as { id: number }[];
      const tasks = items.map((item) => async () => {
        try {
          await tmdb.getDetails(apiKey, item.id, type, { language: 'en' });
          warmed++;
        } catch (err) {
          skipped++;
          log.debug('Detail warming skipped', { id: item.id, type, error: (err as Error).message });
        }
      });

      await batchWithConcurrency(tasks, CONCURRENCY);
    }
  }

  log.info('Trending meta pre-warming complete', { warmed, skipped });
  return { warmed, skipped };
}

async function warmImdbEnrichment(apiKey: string | null): Promise<void> {
  if (!apiKey || !imdb.isImdbApiEnabled()) return;

  const types: ContentType[] = ['movie', 'series'];
  const listTypes = ['top250', 'popular'] as const;
  const cache = getCache();

  for (const type of types) {
    for (const listType of listTypes) {
      try {
        const result =
          listType === 'top250' ? await imdb.getTopRanking(type) : await imdb.getPopular(type);

        const allTitles = (result.titles || []) as { id: string }[];

        for (
          let page = 0;
          page * IMDB_PAGE_SIZE < Math.min(allTitles.length, IMDB_PAGE_SIZE * 2);
          page++
        ) {
          const skip = page * IMDB_PAGE_SIZE;
          const pageTitles = allTitles.slice(skip, skip + IMDB_PAGE_SIZE);
          if (pageTitles.length === 0) break;

          const enrichmentKey = buildWarmerEnrichmentKey(type, listType, skip);
          const cached = await cache.get(enrichmentKey).catch(() => null);
          if (cached) continue;

          const imdbIds = pageTitles
            .map((t) => t.id)
            .filter((id): id is string => !!id && /^tt\d+$/.test(id));

          const { resolvedIds, detailsMap } = await tmdb.batchResolveAndFetchDetails(
            apiKey,
            imdbIds,
            type,
            { displayLanguage: 'en' },
            { language: 'en' }
          );

          const detailsForRatings = Array.from(detailsMap.values()).map((d) => ({
            imdb_id:
              (d as { external_ids?: { imdb_id?: string } })?.external_ids?.imdb_id || undefined,
          }));
          let ratingsMap: Map<string, string> | null = null;
          try {
            ratingsMap = await tmdb.batchGetCinemetaRatings(detailsForRatings, type);
          } catch (ratingErr) {
            logSwallowedError('cacheWarmer:imdb-ratings', ratingErr);
          }

          const metas = (
            await Promise.all(
              pageTitles.map(async (title) => {
                const tmdbId = resolvedIds.get(title.id);
                if (!tmdbId) return null;
                const details = detailsMap.get(tmdbId);
                if (!details) return null;
                return tmdb.toStremioMetaPreview(
                  details as Parameters<typeof tmdb.toStremioMetaPreview>[0],
                  type,
                  null,
                  'en',
                  ratingsMap
                );
              })
            )
          ).filter((m) => m !== null);

          await cache
            .set(enrichmentKey, metas, CACHE_TTLS.CATALOG_SERVER_DISCOVER)
            .catch((e) => logSwallowedError('cacheWarmer:imdb-enrichment-set', e));

          log.debug('IMDb enrichment warmed', { type, listType, skip, count: metas.length });
        }
      } catch (err) {
        logSwallowedError(`cacheWarmer:imdb-enrichment-${type}-${listType}`, err);
      }
    }
  }

  log.info('IMDb enrichment pre-warming complete');
}

function buildWarmerEnrichmentKey(type: ContentType, listType: string, skip: number): string {
  return `catalog-imdb:${type}:${listType}:${skip}:none`;
}
