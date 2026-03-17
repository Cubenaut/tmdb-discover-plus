import { createLogger } from '../utils/logger.ts';
import { config } from '../config.ts';
import * as tmdb from '../services/tmdb/index.ts';
import * as imdb from '../services/imdb/index.ts';
import { getTmdbThrottle } from './tmdbThrottle.ts';
import type { ContentType } from '../types/index.ts';

const log = createLogger('CacheWarmer');

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
