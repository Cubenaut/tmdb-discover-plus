import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CACHE_TTLS, TIMEOUTS, catalogServerTtl } from '../../src/constants.ts';

describe('catalogServerTtl', () => {
  it('returns trending TTL for trending list type', () => {
    expect(catalogServerTtl('trending')).toBe(CACHE_TTLS.CATALOG_SERVER_TRENDING);
  });

  it('returns trending TTL for now_playing', () => {
    expect(catalogServerTtl('now_playing')).toBe(CACHE_TTLS.CATALOG_SERVER_TRENDING);
  });

  it('returns trending TTL for upcoming', () => {
    expect(catalogServerTtl('upcoming')).toBe(CACHE_TTLS.CATALOG_SERVER_TRENDING);
  });

  it('returns trending TTL for on_the_air', () => {
    expect(catalogServerTtl('on_the_air')).toBe(CACHE_TTLS.CATALOG_SERVER_TRENDING);
  });

  it('returns trending TTL for popular', () => {
    expect(catalogServerTtl('popular')).toBe(CACHE_TTLS.CATALOG_SERVER_TRENDING);
  });

  it('returns discover TTL for discover list type', () => {
    expect(catalogServerTtl('discover')).toBe(CACHE_TTLS.CATALOG_SERVER_DISCOVER);
  });

  it('returns discover TTL for undefined list type', () => {
    expect(catalogServerTtl(undefined)).toBe(CACHE_TTLS.CATALOG_SERVER_DISCOVER);
  });

  it('returns discover TTL for null list type', () => {
    expect(catalogServerTtl(null)).toBe(CACHE_TTLS.CATALOG_SERVER_DISCOVER);
  });

  it('returns discover TTL for unknown list type', () => {
    expect(catalogServerTtl('my_custom_list')).toBe(CACHE_TTLS.CATALOG_SERVER_DISCOVER);
  });
});

describe('TTL constants', () => {
  it('META_HEADER is 24 hours', () => {
    expect(CACHE_TTLS.META_HEADER).toBe(86_400);
  });

  it('CATALOG_HEADER is 3 hours', () => {
    expect(CACHE_TTLS.CATALOG_HEADER).toBe(10_800);
  });

  it('CATALOG_STALE_REVALIDATE is 1 hour', () => {
    expect(CACHE_TTLS.CATALOG_STALE_REVALIDATE).toBe(3_600);
  });

  it('CATALOG_SERVER_DISCOVER is 24 hours', () => {
    expect(CACHE_TTLS.CATALOG_SERVER_DISCOVER).toBe(86_400);
  });

  it('CATALOG_SERVER_TRENDING is 3 hours', () => {
    expect(CACHE_TTLS.CATALOG_SERVER_TRENDING).toBe(10_800);
  });

  it('RPDB timeout is 1.5 seconds', () => {
    expect(TIMEOUTS.RPDB_FETCH_MS).toBe(1_500);
  });
});

describe('warmTrendingMeta', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches trending pages for both movie and series', async () => {
    const fetchSpecialListMock = vi.fn().mockResolvedValue({
      results: [{ id: 100 }, { id: 200 }],
    });
    const getDetailsMock = vi.fn().mockResolvedValue({ id: 100, title: 'Test' });

    vi.doMock('../../src/services/tmdb/index.ts', () => ({
      fetchSpecialList: fetchSpecialListMock,
      getDetails: getDetailsMock,
    }));

    const { warmTrendingMeta } = await import('../../src/infrastructure/cacheWarmer.ts');
    await warmTrendingMeta('test-api-key');

    const trendingCalls = fetchSpecialListMock.mock.calls.filter((call) => call[1] === 'trending');
    expect(trendingCalls.length).toBe(10);

    const movieCalls = trendingCalls.filter((call) => call[2] === 'movie');
    const seriesCalls = trendingCalls.filter((call) => call[2] === 'series');
    expect(movieCalls.length).toBe(5);
    expect(seriesCalls.length).toBe(5);
  });

  it('calls getDetails for each trending item', async () => {
    const fetchSpecialListMock = vi.fn().mockResolvedValue({
      results: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    const getDetailsMock = vi.fn().mockResolvedValue({ id: 1 });

    vi.doMock('../../src/services/tmdb/index.ts', () => ({
      fetchSpecialList: fetchSpecialListMock,
      getDetails: getDetailsMock,
    }));

    const { warmTrendingMeta } = await import('../../src/infrastructure/cacheWarmer.ts');
    await warmTrendingMeta('test-api-key');

    expect(getDetailsMock).toHaveBeenCalled();
    const idArgs = getDetailsMock.mock.calls.map((call) => call[1]);
    expect(idArgs).toContain(1);
    expect(idArgs).toContain(2);
    expect(idArgs).toContain(3);
  });

  it('returns zero counts when apiKey is null', async () => {
    const { warmTrendingMeta } = await import('../../src/infrastructure/cacheWarmer.ts');
    const result = await warmTrendingMeta(null);
    expect(result).toEqual({ warmed: 0, skipped: 0 });
  });

  it('continues warming other items when one getDetails call fails', async () => {
    let callCount = 0;
    const fetchSpecialListMock = vi.fn().mockResolvedValue({
      results: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    const getDetailsMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error('TMDB error');
      return Promise.resolve({ id: callCount });
    });

    vi.doMock('../../src/services/tmdb/index.ts', () => ({
      fetchSpecialList: fetchSpecialListMock,
      getDetails: getDetailsMock,
    }));

    const { warmTrendingMeta } = await import('../../src/infrastructure/cacheWarmer.ts');
    await expect(warmTrendingMeta('test-key')).resolves.not.toThrow();
  });
});
