import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/tmdb/index.ts', () => ({
  getGenres: vi.fn(),
  getCertifications: vi.fn(),
}));
vi.mock('../../src/utils/helpers.ts', () => ({
  normalizeGenreName: vi.fn((s: string) => s.toLowerCase()),
  parseIdArray: vi.fn((s: string) => s.split(',')),
}));
vi.mock('../../src/services/configService.ts', () => ({
  getApiKeyFromConfig: vi.fn(),
  updateCatalogGenres: vi.fn(),
}));

vi.mock('../../src/config.ts', () => ({
  config: {
    addon: { variant: undefined },
    baseUrl: 'https://example.com',
    cache: { maxKeys: 20000 },
    logging: { level: 'info', format: 'text' },
    nodeEnv: 'test',
  },
}));

vi.mock('../../src/services/imdb/index.ts', () => ({
  isImdbApiEnabled: vi.fn(() => false),
}));

import { buildManifest } from '../../src/services/manifestService.ts';
import { enrichManifestWithExtras } from '../../src/services/manifestService.ts';
import * as tmdb from '../../src/services/tmdb/index.ts';
import { getApiKeyFromConfig } from '../../src/services/configService.ts';

describe('buildManifest', () => {
  const baseUrl = 'https://example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds manifest with catalogs', () => {
    const userConfig = {
      catalogs: [
        { _id: 'action-movies', name: 'Action Movies', type: 'movie', enabled: true },
        { _id: 'top-tv', name: 'Top TV', type: 'series', enabled: true },
      ],
    };
    const manifest = buildManifest(userConfig, baseUrl);
    expect(manifest.id).toBe('community.tmdb.discover.plus');
    expect(manifest.catalogs.length).toBe(4);
    expect(manifest.catalogs[0].id).toBe('tmdb-action-movies');
    expect(manifest.catalogs[0].type).toBe('movie');
    expect(manifest.catalogs[1].id).toBe('tmdb-top-tv');
    expect(manifest.catalogs[1].type).toBe('series');
    expect(manifest.catalogs[2].id).toBe('tmdb-search-movie');
    expect(manifest.catalogs[3].id).toBe('tmdb-search-series');
  });

  it('filters out disabled catalogs', () => {
    const userConfig = {
      catalogs: [
        { _id: 'enabled', name: 'Enabled', type: 'movie', enabled: true },
        { _id: 'disabled', name: 'Disabled', type: 'movie', enabled: false },
      ],
    };
    const manifest = buildManifest(userConfig, baseUrl);
    const catalogIds = manifest.catalogs.map((c: any) => c.id);
    expect(catalogIds).toContain('tmdb-enabled');
    expect(catalogIds).not.toContain('tmdb-disabled');
  });

  it('omits search catalogs when disableSearch is true', () => {
    const manifest = buildManifest({ catalogs: [], preferences: { disableSearch: true } }, baseUrl);
    expect(manifest.catalogs.length).toBe(0);
  });

  it('omits Trakt search catalogs when disableTraktSearch is not explicitly false', () => {
    const manifest = buildManifest(
      {
        catalogs: [{ _id: 'trakt-list', name: 'Trakt List', type: 'movie', source: 'trakt' }],
        preferences: { disableTraktSearch: true },
      },
      baseUrl
    );

    const ids = manifest.catalogs.map((catalog: any) => catalog.id);
    expect(ids).toContain('trakt-trakt-list');
    expect(ids).not.toContain('trakt-search-movie');
    expect(ids).not.toContain('trakt-search-series');
  });

  it('generates catalog ID from name when _id is missing', () => {
    const manifest = buildManifest(
      { catalogs: [{ name: 'My Custom List', type: 'movie' }] },
      baseUrl
    );
    expect(manifest.catalogs[0].id).toBe('tmdb-my-custom-list');
  });

  it('has correct behaviorHints', () => {
    const manifest = buildManifest({ catalogs: [] }, baseUrl);
    expect(manifest.behaviorHints.configurable).toBe(true);
    expect(manifest.behaviorHints.newEpisodeNotifications).toBe(true);
  });

  it('includes correct resources, types, and idPrefixes', () => {
    const manifest = buildManifest({ catalogs: [] }, baseUrl);
    expect(manifest.resources).toEqual(['catalog', 'meta']);
    expect(manifest.types).toEqual(['movie', 'series']);
    expect(manifest.idPrefixes).toEqual(['tmdb:', 'tt']);
  });

  it('sets pageSize to 20 for all catalogs', () => {
    const manifest = buildManifest(
      { catalogs: [{ _id: 'test', name: 'Test', type: 'movie' }] },
      baseUrl
    );
    expect(manifest.catalogs[0].pageSize).toBe(20);
  });

  it('handles empty/null config gracefully', () => {
    expect(buildManifest(null, baseUrl).catalogs.length).toBe(2);
    expect(buildManifest({}, baseUrl).catalogs.length).toBe(2);
  });

  it('maps year mode to a single genre dropdown options list', async () => {
    const userConfig = {
      userId: 'user1',
      catalogs: [
        {
          _id: 'tmdb-year',
          name: 'Year Catalog',
          type: 'movie',
          source: 'tmdb',
          enabled: true,
          filters: { stremioExtraMode: 'year' },
        },
      ],
      preferences: { disableSearch: true },
    };

    const manifest = buildManifest(userConfig as any, baseUrl);
    await enrichManifestWithExtras(manifest, userConfig as any);

    const target = manifest.catalogs.find((c) => c.id === 'tmdb-tmdb-year');
    expect(target).toBeTruthy();
    const genreExtra = target?.extra.find((e) => e.name === 'genre');
    expect(genreExtra).toBeTruthy();
    expect(genreExtra?.options?.[0]).toBe('All');
    expect(genreExtra?.options).toContain(String(new Date().getFullYear()));
    expect(target?.extra.some((e) => e.name === 'year')).toBe(false);
  });

  it('limits year options to selected range and excludes future years when releasedOnly is enabled', async () => {
    const currentYear = new Date().getFullYear();
    const userConfig = {
      userId: 'user-year-range',
      catalogs: [
        {
          _id: 'tmdb-year-range',
          name: 'Year Range Catalog',
          type: 'movie',
          source: 'tmdb',
          enabled: true,
          filters: {
            stremioExtraMode: 'year',
            releasedOnly: true,
            yearFrom: currentYear - 2,
            yearTo: currentYear + 3,
          },
        },
      ],
      preferences: { disableSearch: true },
    };

    const manifest = buildManifest(userConfig as any, baseUrl);
    await enrichManifestWithExtras(manifest, userConfig as any);

    const target = manifest.catalogs.find((c) => c.id === 'tmdb-tmdb-year-range');
    const genreExtra = target?.extra.find((e) => e.name === 'genre');

    expect(genreExtra?.options).toEqual([
      'All',
      String(currentYear),
      String(currentYear - 1),
      String(currentYear - 2),
    ]);
  });

  it('maps sortBy mode to a single genre dropdown options list', async () => {
    const userConfig = {
      userId: 'user2',
      catalogs: [
        {
          _id: 'tmdb-sort',
          name: 'Sort Catalog',
          type: 'series',
          source: 'tmdb',
          enabled: true,
          filters: { stremioExtraMode: 'sortBy' },
        },
      ],
      preferences: { disableSearch: true },
    };

    const manifest = buildManifest(userConfig as any, baseUrl);
    await enrichManifestWithExtras(manifest, userConfig as any);

    const target = manifest.catalogs.find((c) => c.id === 'tmdb-tmdb-sort');
    expect(target).toBeTruthy();
    const genreExtra = target?.extra.find((e) => e.name === 'genre');
    expect(genreExtra).toBeTruthy();
    expect(genreExtra?.options?.[0]).toBe('All');
    expect(genreExtra?.options).toContain('Most Popular');
    expect(target?.extra.some((e) => e.name === 'sortBy')).toBe(false);
  });

  it('maps certification options to selected country and selected certifications only', async () => {
    const getCertificationsMock = vi.mocked(tmdb.getCertifications);
    const getApiKeyMock = vi.mocked(getApiKeyFromConfig);
    getApiKeyMock.mockReturnValue('tmdb-key');
    getCertificationsMock.mockResolvedValue({
      US: [{ certification: 'PG' }, { certification: 'R' }],
      DE: [{ certification: 'FSK 12' }, { certification: 'FSK 16' }],
    } as any);

    const userConfig = {
      userId: 'user-cert-country',
      catalogs: [
        {
          _id: 'tmdb-cert-country',
          name: 'Certification Catalog',
          type: 'movie',
          source: 'tmdb',
          enabled: true,
          filters: {
            stremioExtraMode: 'certification',
            certificationCountry: 'DE',
            certifications: ['FSK 16'],
          },
        },
      ],
      preferences: { disableSearch: true },
    };

    const manifest = buildManifest(userConfig as any, baseUrl);
    await enrichManifestWithExtras(manifest, userConfig as any);

    const target = manifest.catalogs.find((c) => c.id === 'tmdb-tmdb-cert-country');
    const genreExtra = target?.extra.find((e) => e.name === 'genre');

    expect(genreExtra?.options).toEqual(['All', 'FSK 16']);
    expect(genreExtra?.options).not.toContain('PG');
    expect(getCertificationsMock).toHaveBeenCalledWith('tmdb-key', 'movie');
  });
});
