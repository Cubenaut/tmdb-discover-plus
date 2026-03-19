import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedImdbFetch, cacheGet, cacheSet } = vi.hoisted(() => ({
  mockedImdbFetch: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock('../../src/services/imdb/client.ts', () => ({
  imdbFetch: mockedImdbFetch,
}));

vi.mock('../../src/services/cache/index.ts', () => ({
  getCache: vi.fn(() => ({
    get: cacheGet,
    set: cacheSet,
  })),
}));

vi.mock('../../src/config.ts', () => ({
  config: {
    imdbApi: {
      cacheTtlSearch: 300,
      cacheTtlRanking: 300,
      cacheTtlPopular: 300,
      cacheTtlList: 300,
    },
    logging: { level: 'info', format: 'text' },
    nodeEnv: 'test',
  },
}));

import { advancedSearch } from '../../src/services/imdb/discover.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('imdb advancedSearch pagination cursor hydration', () => {
  it('rebuilds cursor key from cached first page so skip=20 can continue', async () => {
    cacheGet.mockImplementation(async (key: string) => {
      if (key.includes('imdb:catalog:') && key.includes(':skip0')) {
        return {
          titles: [{ id: 'tt1234567' }],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-from-cached-page-1' },
        };
      }
      if (key.includes('imdb:cursor:') && key.includes(':skip20')) {
        return null;
      }
      return null;
    });

    const result = await advancedSearch({}, 'movie', 0);

    expect(result.titles).toHaveLength(1);
    expect(mockedImdbFetch).not.toHaveBeenCalled();
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringMatching(/^imdb:cursor:.*:skip20$/),
      'cursor-from-cached-page-1',
      300
    );
  });

  it('does not overwrite existing next cursor when already present', async () => {
    cacheGet.mockImplementation(async (key: string) => {
      if (key.includes('imdb:catalog:') && key.includes(':skip20')) {
        return {
          titles: [{ id: 'tt7654321' }],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-from-cached-page-2' },
        };
      }
      if (key.includes('imdb:cursor:') && key.includes(':skip40')) {
        return 'existing-cursor-40';
      }
      return null;
    });

    const result = await advancedSearch({}, 'movie', 20);

    expect(result.titles).toHaveLength(1);
    expect(mockedImdbFetch).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('walks from first page to recover skip=20 when cursor cache is missing', async () => {
    cacheGet.mockResolvedValue(null);

    mockedImdbFetch
      .mockResolvedValueOnce({
        titles: [{ id: 'tt1111111' }],
        pageInfo: { hasNextPage: true, endCursor: 'cursor-live-first-page' },
      })
      .mockResolvedValueOnce({
        titles: [{ id: 'tt2222222' }],
        pageInfo: { hasNextPage: true, endCursor: 'cursor-live-second-page' },
      });

    const result = await advancedSearch({}, 'movie', 20);

    expect(result.titles).toHaveLength(1);
    expect(mockedImdbFetch).toHaveBeenCalledTimes(2);
    expect(mockedImdbFetch).toHaveBeenNthCalledWith(
      2,
      '/api/imdb/search/advanced',
      expect.objectContaining({ endCursor: 'cursor-live-first-page' }),
      300
    );
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringMatching(/^imdb:cursor:.*:skip20$/),
      'cursor-live-first-page',
      300
    );
  });
});
