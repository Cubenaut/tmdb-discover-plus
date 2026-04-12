import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tmdb from './tmdb/index.ts';
import * as imdb from './imdb/index.ts';
import * as anilist from './anilist/index.ts';
import * as mal from './mal/index.ts';
import * as simkl from './simkl/index.ts';
import * as trakt from './trakt/index.ts';
import { getSource } from './sources/registry.ts';
import { normalizeGenreName, parseIdArray } from '../utils/helpers.ts';
import { resolveDynamicDatePreset } from '../utils/dateHelpers.ts';
import { createLogger } from '../utils/logger.ts';
import { getApiKeyFromConfig, updateCatalogGenres } from './configService.ts';
import { config } from '../config.ts';
import { SORT_OPTIONS } from './tmdb/referenceData.ts';
import type { UserConfig, StremioManifest, ManifestCatalog, TmdbGenre } from '../types/index.ts';

const log = createLogger('manifestService');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADDON_VARIANT = config.addon.variant;
const ADDON_ID = ADDON_VARIANT
  ? `community.tmdb.discover.plus.${ADDON_VARIANT}`
  : 'community.tmdb.discover.plus';
const BASE_ADDON_NAME = 'TMDB Discover+';
const ADDON_DESCRIPTION = 'Create custom movie and TV catalogs with powerful TMDB filters';
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
const ADDON_VERSION = pkg.version;

type StremioExtraMode = 'genre' | 'year' | 'sortBy' | 'certification';
const STREMIO_EXTRA_MODES: StremioExtraMode[] = ['genre', 'year', 'sortBy', 'certification'];
const TMDB_STREMIO_EXTRA_MODES: StremioExtraMode[] = ['genre', 'year', 'sortBy', 'certification'];
const GENRE_ONLY_STREMIO_EXTRA_MODES: StremioExtraMode[] = ['genre'];

const MIN_DROPDOWN_YEAR = 1900;

function parseNumericYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseYearFromDateLike(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDropdownYearBounds(
  lower: number,
  upper: number,
  maxYear: number
): { lower: number; upper: number } {
  const boundedUpper = Math.min(Math.max(upper, MIN_DROPDOWN_YEAR), maxYear);
  const boundedLower = Math.min(Math.max(lower, MIN_DROPDOWN_YEAR), boundedUpper);

  return { lower: boundedLower, upper: boundedUpper };
}

function buildYearDropdownOptions(
  filters: Record<string, unknown> | undefined,
  catalogType: 'movie' | 'series'
): string[] {
  const nowYear = new Date().getFullYear();
  const maxYear = filters?.releasedOnly === true ? nowYear : nowYear + 2;
  const resolved = resolveDynamicDatePreset(filters || {}, catalogType);

  const isMovie = catalogType === 'movie';
  const fromDateField = isMovie ? 'releaseDateFrom' : 'airDateFrom';
  const toDateField = isMovie ? 'releaseDateTo' : 'airDateTo';
  const exactYearField = isMovie ? 'primaryReleaseYear' : 'firstAirDateYear';

  const lowerCandidates: number[] = [];
  const upperCandidates: number[] = [];

  const yearFrom = parseNumericYear(resolved.yearFrom);
  if (yearFrom != null) lowerCandidates.push(yearFrom);

  const yearTo = parseNumericYear(resolved.yearTo);
  if (yearTo != null) upperCandidates.push(yearTo);

  const dateFrom = parseYearFromDateLike(resolved[fromDateField]);
  if (dateFrom != null) lowerCandidates.push(dateFrom);

  const dateTo = parseYearFromDateLike(resolved[toDateField]);
  if (dateTo != null) upperCandidates.push(dateTo);

  if (!isMovie) {
    const firstAirFrom = parseYearFromDateLike(resolved.firstAirDateFrom);
    if (firstAirFrom != null) lowerCandidates.push(firstAirFrom);

    const firstAirTo = parseYearFromDateLike(resolved.firstAirDateTo);
    if (firstAirTo != null) upperCandidates.push(firstAirTo);
  }

  const exactYear = parseNumericYear(resolved[exactYearField]);
  if (exactYear != null) {
    lowerCandidates.push(exactYear);
    upperCandidates.push(exactYear);
  }

  const candidateLower =
    lowerCandidates.length > 0 ? Math.max(...lowerCandidates) : MIN_DROPDOWN_YEAR;
  const candidateUpper = upperCandidates.length > 0 ? Math.min(...upperCandidates) : maxYear;
  const { lower, upper } = normalizeDropdownYearBounds(candidateLower, candidateUpper, maxYear);

  const options = ['All'];
  for (let year = upper; year >= lower; year -= 1) {
    options.push(String(year));
  }

  return options;
}

function buildCertificationDropdownOptions(
  filters: Record<string, unknown> | undefined,
  countryCerts: { certification: string }[]
): string[] {
  const available = Array.from(
    new Set(
      (countryCerts || [])
        .map((entry) => entry?.certification)
        .filter((cert): cert is string => typeof cert === 'string' && cert.trim().length > 0)
    )
  );

  const selectedValues = [
    ...(Array.isArray(filters?.certifications) ? filters.certifications : []),
    ...(typeof filters?.certification === 'string' ? [filters.certification] : []),
  ]
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  const selectedSet = new Set(selectedValues.map((value) => value.toLowerCase()));
  const selectedOnly =
    selectedSet.size > 0
      ? available.filter((value) => selectedSet.has(value.toLowerCase()))
      : available;

  const fallbackSelectedOnly =
    selectedSet.size > 0 && selectedOnly.length === 0
      ? Array.from(new Set(selectedValues))
      : selectedOnly;

  return ['All', ...fallbackSelectedOnly];
}

function getStremioExtraMode(
  filters: Record<string, unknown> | undefined,
  supportedModes: StremioExtraMode[] = STREMIO_EXTRA_MODES
): StremioExtraMode {
  const firstSupportedMode = supportedModes[0] || 'genre';
  const rawMode = filters?.stremioExtraMode;
  if (
    (rawMode === 'genre' ||
      rawMode === 'year' ||
      rawMode === 'sortBy' ||
      rawMode === 'certification') &&
    supportedModes.includes(rawMode)
  ) {
    return rawMode;
  }

  const legacy = Array.isArray(filters?.stremioExtras) ? filters?.stremioExtras[0] : undefined;
  if (
    (legacy === 'genre' ||
      legacy === 'year' ||
      legacy === 'sortBy' ||
      legacy === 'certification') &&
    supportedModes.includes(legacy)
  ) {
    return legacy;
  }

  return firstSupportedMode;
}

function upsertGenreExtra(
  catalog: ManifestCatalog,
  rawOptions: string[],
  isRequired: boolean = false
): void {
  const options = Array.from(
    new Set(
      (rawOptions || [])
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0 && value.toLowerCase() !== 'all')
    )
  ).sort((a, b) => a.localeCompare(b));

  if (options.length === 0) return;

  catalog.extra = (catalog.extra || []).filter((extra) => extra.name !== 'genre');
  catalog.extra.push({
    name: 'genre',
    options: ['All', ...options],
    optionsLimit: 1,
    isRequired,
  });
}

export function buildManifest(userConfig: UserConfig | null, baseUrl: string): StremioManifest {
  const resolvedBaseUrl = config.baseUrl || baseUrl;
  const addonName = userConfig?.configName
    ? `${BASE_ADDON_NAME} - ${userConfig.configName}`
    : BASE_ADDON_NAME;
  const catalogs: ManifestCatalog[] = (userConfig?.catalogs || [])
    .filter((c) => c.enabled !== false)
    .map((catalog) => {
      const source = getSource(catalog.source ?? 'tmdb');
      const prefix = source.catalogIdPrefix;
      const pageSize = source.defaultPageSize;

      return {
        id: `${prefix}-${catalog._id || catalog.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: catalog.type === 'series' ? 'series' : 'movie',
        name: catalog.name,
        pageSize,
        extra: [{ name: 'skip' }],
      };
    });

  if (userConfig?.preferences?.disableSearch !== true) {
    if (userConfig?.preferences?.disableTmdbSearch !== true) {
      catalogs.push({
        id: 'tmdb-search-movie',
        type: 'movie',
        name: 'TMDB Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
      catalogs.push({
        id: 'tmdb-search-series',
        type: 'series',
        name: 'TMDB Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
    }

    if (imdb.isImdbApiEnabled() && userConfig?.preferences?.disableImdbSearch === false) {
      catalogs.push({
        id: 'imdb-search-movie',
        type: 'movie',
        name: 'IMDb Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
      catalogs.push({
        id: 'imdb-search-series',
        type: 'series',
        name: 'IMDb Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
    }

    const hasAnilistCatalogs = (userConfig?.catalogs || []).some(
      (c) => c.source === 'anilist' && c.enabled !== false
    );
    if (hasAnilistCatalogs && userConfig?.preferences?.disableAnilistSearch === false) {
      catalogs.push({
        id: 'anilist-search-movie',
        type: 'movie',
        name: 'AniList Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
      catalogs.push({
        id: 'anilist-search-series',
        type: 'series',
        name: 'AniList Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
    }

    const hasMalCatalogs = (userConfig?.catalogs || []).some(
      (c) => c.source === 'mal' && c.enabled !== false
    );
    if (hasMalCatalogs && userConfig?.preferences?.disableMalSearch === false) {
      catalogs.push({
        id: 'mal-search-movie',
        type: 'movie',
        name: 'MAL Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
      catalogs.push({
        id: 'mal-search-series',
        type: 'series',
        name: 'MAL Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
    }

    const hasSimklCatalogs = (userConfig?.catalogs || []).some(
      (c) => c.source === 'simkl' && c.enabled !== false
    );
    if (hasSimklCatalogs && userConfig?.preferences?.disableSimklSearch === false) {
      catalogs.push({
        id: 'simkl-search-movie',
        type: 'movie',
        name: 'Simkl Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
      catalogs.push({
        id: 'simkl-search-series',
        type: 'series',
        name: 'Simkl Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
    }

    const hasTraktCatalogs = (userConfig?.catalogs || []).some(
      (c) => c.source === 'trakt' && c.enabled !== false
    );
    if (hasTraktCatalogs && userConfig?.preferences?.disableTraktSearch === false) {
      catalogs.push({
        id: 'trakt-search-movie',
        type: 'movie',
        name: 'Trakt Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
      catalogs.push({
        id: 'trakt-search-series',
        type: 'series',
        name: 'Trakt Search',
        extra: [{ name: 'search', isRequired: true }, { name: 'skip' }],
      });
    }
  }

  return {
    id: ADDON_ID,
    name: addonName,
    description: ADDON_DESCRIPTION,
    version: ADDON_VERSION,
    logo: `${resolvedBaseUrl.replace(/\/$/, '')}/logo.png`,
    idPrefixes: ['tmdb:', 'tt'],
    resources: ['catalog', 'meta'],
    types: ['movie', 'series'],
    catalogs,
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
      newEpisodeNotifications: true,
    },
  };
}

export async function enrichManifestWithGenres(
  manifest: StremioManifest,
  config: UserConfig
): Promise<void> {
  if (!manifest.catalogs || !Array.isArray(manifest.catalogs) || !config) return;

  await Promise.all(
    manifest.catalogs.map(async (catalog) => {
      try {
        if (catalog.id.includes('-search-')) return;

        if (catalog.id.startsWith('imdb-')) {
          const savedCatalog = (config.catalogs || []).find((c) => {
            const idFromStored = `imdb-${c._id || c.name.toLowerCase().replace(/\s+/g, '-')}`;
            return idFromStored === catalog.id;
          });
          if (!savedCatalog) return;

          const dropdownMode = getStremioExtraMode(
            savedCatalog.filters as Record<string, unknown> | undefined,
            GENRE_ONLY_STREMIO_EXTRA_MODES
          );
          if (dropdownMode !== 'genre') return;

          const imdbGenres = await imdb.getGenres();
          upsertGenreExtra(catalog, imdbGenres, savedCatalog.filters?.discoverOnly === true);
          return;
        }

        if (catalog.id.startsWith('anilist-')) {
          const savedCatalog = (config.catalogs || []).find((c) => {
            const idFromStored = `anilist-${c._id || c.name.toLowerCase().replace(/\s+/g, '-')}`;
            return idFromStored === catalog.id;
          });
          if (!savedCatalog) return;

          const dropdownMode = getStremioExtraMode(
            savedCatalog.filters as Record<string, unknown> | undefined,
            GENRE_ONLY_STREMIO_EXTRA_MODES
          );
          if (dropdownMode !== 'genre') return;

          upsertGenreExtra(
            catalog,
            [...anilist.getGenres()],
            savedCatalog.filters?.discoverOnly === true
          );
          return;
        }

        if (catalog.id.startsWith('mal-')) {
          const savedCatalog = (config.catalogs || []).find((c) => {
            const idFromStored = `mal-${c._id || c.name.toLowerCase().replace(/\s+/g, '-')}`;
            return idFromStored === catalog.id;
          });
          if (!savedCatalog) return;

          const dropdownMode = getStremioExtraMode(
            savedCatalog.filters as Record<string, unknown> | undefined,
            GENRE_ONLY_STREMIO_EXTRA_MODES
          );
          if (dropdownMode !== 'genre') return;

          upsertGenreExtra(
            catalog,
            mal.getGenres().map((genre) => genre.name),
            savedCatalog.filters?.discoverOnly === true
          );
          return;
        }

        if (catalog.id.startsWith('simkl-')) {
          const savedCatalog = (config.catalogs || []).find((c) => {
            const idFromStored = `simkl-${c._id || c.name.toLowerCase().replace(/\s+/g, '-')}`;
            return idFromStored === catalog.id;
          });
          if (!savedCatalog) return;

          const dropdownMode = getStremioExtraMode(
            savedCatalog.filters as Record<string, unknown> | undefined,
            GENRE_ONLY_STREMIO_EXTRA_MODES
          );
          if (dropdownMode !== 'genre') return;

          upsertGenreExtra(
            catalog,
            [...simkl.getGenres()],
            savedCatalog.filters?.discoverOnly === true
          );
          return;
        }

        if (catalog.id.startsWith('trakt-')) {
          const savedCatalog = (config.catalogs || []).find((c) => {
            const idFromStored = `trakt-${c._id || c.name.toLowerCase().replace(/\s+/g, '-')}`;
            return idFromStored === catalog.id;
          });
          if (!savedCatalog) return;

          const dropdownMode = getStremioExtraMode(
            savedCatalog.filters as Record<string, unknown> | undefined,
            GENRE_ONLY_STREMIO_EXTRA_MODES
          );
          if (dropdownMode !== 'genre') return;

          const traktGenresByType = await trakt.getGenresByType();
          const scopedGenres =
            catalog.type === 'series' ? traktGenresByType.series : traktGenresByType.movie;
          upsertGenreExtra(
            catalog,
            scopedGenres.map((genre) => genre.name),
            savedCatalog.filters?.discoverOnly === true
          );
          return;
        }

        const helperType = catalog.type === 'series' ? 'series' : 'movie';
        const staticKey = catalog.type === 'series' ? 'tv' : 'movie';

        let idToName: Record<string, string> = {};
        let fullNames: string[] | null = null;

        try {
          const resolvedApiKey = getApiKeyFromConfig(config);
          if (resolvedApiKey) {
            const live = await tmdb.getGenres(resolvedApiKey, helperType);
            if (Array.isArray(live) && live.length > 0) {
              live.forEach((g) => {
                idToName[String(g.id)] = g.name;
              });
              fullNames = live.map((g) => g.name);
            }
          }
        } catch (err) {}

        if (!fullNames) {
          try {
            const genresPath = path.join(__dirname, '..', 'data', 'tmdb_genres.json');
            const raw = fs.readFileSync(genresPath, 'utf8');
            const staticGenreMap = JSON.parse(raw);
            const mapping = staticGenreMap[staticKey] || {};
            Object.entries(mapping).forEach(([id, name]) => {
              idToName[String(id)] = name as string;
            });
            fullNames = Object.values(mapping || {}) as string[];
          } catch (err) {
            idToName = {};
            fullNames = null;
          }
        }

        let isDiscoverOnly = false;
        let options: string[] | null = null;
        let healedFixes: Record<string, { genres: number[]; genreNames: string[] }> | null = null;

        try {
          const savedCatalog = (config.catalogs || []).find((c) => {
            const idFromStored = `tmdb-${c._id || c.name.toLowerCase().replace(/\s+/g, '-')}`;
            const idFromIdOnly = `tmdb-${String(c._id)}`;
            return idFromStored === catalog.id || idFromIdOnly === catalog.id;
          });

          const dropdownMode = getStremioExtraMode(
            savedCatalog?.filters as Record<string, unknown> | undefined,
            TMDB_STREMIO_EXTRA_MODES
          );
          if (dropdownMode !== 'genre') {
            return;
          }

          if (savedCatalog) {
            isDiscoverOnly = savedCatalog.filters?.discoverOnly === true;
          }

          if (savedCatalog && savedCatalog.filters) {
            const selected = parseIdArray(savedCatalog.filters.genres);
            const excluded = parseIdArray(savedCatalog.filters.excludeGenres);

            if (selected.length > 0) {
              options = selected.map((gid) => idToName[String(gid)]).filter(Boolean);

              if (options.length === 0) {
                log.info('Genre mapping failed, attempting self-healing', {
                  catalogId: catalog.id,
                });

                const apiKey = getApiKeyFromConfig(config);
                if (apiKey) {
                  try {
                    const freshGenres = await tmdb.getGenres(apiKey, helperType);
                    if (Array.isArray(freshGenres) && freshGenres.length > 0) {
                      const freshMap: Record<string, string> = {};
                      freshGenres.forEach((g) => (freshMap[String(g.id)] = g.name));

                      const healedOptions = selected
                        .map((gid) => freshMap[String(gid)])
                        .filter(Boolean);

                      if (healedOptions.length > 0) {
                        options = healedOptions;
                        healedFixes = healedFixes || {};
                        healedFixes[savedCatalog.id!] = {
                          genres: selected.map(Number),
                          genreNames: healedOptions,
                        };
                        log.info('Self-healing successful', {
                          catalogId: catalog.id,
                          genres: healedOptions,
                        });
                      }
                    }
                  } catch (healErr) {
                    log.error('Self-healing failed', { error: (healErr as Error).message });
                  }
                }
              }

              if ((!options || options.length === 0) && fullNames && fullNames.length > 0) {
                const wantedNorm = selected.map((s) => normalizeGenreName(s));
                const matched = fullNames.filter((name) =>
                  wantedNorm.includes(normalizeGenreName(name))
                );
                if (matched.length > 0) {
                  options = matched;
                }
              }

              if (!options || options.length === 0) {
                log.warn('Could not map saved genres after all attempts', {
                  catalogId: catalog.id,
                  selectedCount: selected.length,
                });
              }
            } else if (fullNames && fullNames.length > 0) {
              if (excluded.length > 0) {
                const excludeNames = excluded.map((gid) => idToName[String(gid)]).filter(Boolean);
                const excludeSet = new Set(excludeNames);
                options = fullNames.filter((name) => !excludeSet.has(name));
              } else {
                options = fullNames;
              }
            }
          } else if (fullNames && fullNames.length > 0) {
            options = fullNames;
          }
        } catch (err) {
          options = null;
        }

        if (healedFixes) {
          updateCatalogGenres(config.userId, healedFixes).catch((e) =>
            log.error('Failed to persist healed genres', { error: (e as Error).message })
          );
        }

        if (options && options.length > 0) {
          upsertGenreExtra(catalog, options, isDiscoverOnly);
        }
      } catch (err) {
        log.warn('Error injecting genre options into manifest catalog', {
          error: (err as Error).message,
        });
      }
    })
  );
}

export async function enrichManifestWithExtras(
  manifest: StremioManifest,
  userConfig: UserConfig
): Promise<void> {
  if (!manifest.catalogs || !Array.isArray(manifest.catalogs) || !userConfig) return;

  const apiKey = getApiKeyFromConfig(userConfig);
  const certCache: Record<string, Record<string, { certification: string }[]>> = {};

  for (const catalog of manifest.catalogs) {
    if (catalog.id.includes('-search-')) continue;
    if (!catalog.id.startsWith('tmdb-')) continue;

    const savedCatalog = (userConfig.catalogs || []).find((c) => {
      const idFromStored = `tmdb-${c._id || c.name.toLowerCase().replace(/\s+/g, '-')}`;
      const idFromIdOnly = `tmdb-${String(c._id)}`;
      return idFromStored === catalog.id || idFromIdOnly === catalog.id;
    });
    if (!savedCatalog) continue;

    const dropdownMode = getStremioExtraMode(
      savedCatalog.filters as Record<string, unknown> | undefined,
      TMDB_STREMIO_EXTRA_MODES
    );
    if (dropdownMode === 'genre') continue;

    const catalogType = catalog.type === 'series' ? 'series' : 'movie';
    catalog.extra = (catalog.extra || []).filter((e) => e.name !== 'genre');

    if (dropdownMode === 'year') {
      const years = buildYearDropdownOptions(
        savedCatalog.filters as Record<string, unknown> | undefined,
        catalogType
      );
      catalog.extra.push({ name: 'genre', options: years, optionsLimit: 1 });
    }

    if (dropdownMode === 'sortBy') {
      const sortOpts = SORT_OPTIONS[catalogType] || SORT_OPTIONS.movie;
      catalog.extra.push({
        name: 'genre',
        options: ['All', ...sortOpts.map((s) => s.label)],
        optionsLimit: 1,
      });
    }

    if (dropdownMode === 'certification') {
      try {
        const country = String(savedCatalog.filters?.certificationCountry || 'US').toUpperCase();
        if (!certCache[catalogType] && apiKey) {
          const allCerts = await tmdb.getCertifications(apiKey, catalogType);
          certCache[catalogType] = allCerts as Record<string, { certification: string }[]>;
        }
        const countryMap = certCache[catalogType] || {};
        const countryCerts = countryMap[country] || [];
        const certOptions = buildCertificationDropdownOptions(
          savedCatalog.filters as Record<string, unknown> | undefined,
          countryCerts
        );
        catalog.extra.push({ name: 'genre', options: certOptions, optionsLimit: 1 });
      } catch (err) {
        log.warn('Error building certification extras', { error: (err as Error).message });
      }
    }
  }
}
