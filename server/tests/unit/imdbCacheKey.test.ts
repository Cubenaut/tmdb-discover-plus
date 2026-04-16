import { describe, expect, it } from 'vitest';
import {
  buildImdbEnrichmentCacheKey,
  buildPosterIntegrationScope,
} from '../../src/services/imdb/cacheKey.ts';

describe('IMDb enrichment cache key segregation', () => {
  it('uses none scope when no poster integration key exists', () => {
    expect(buildPosterIntegrationScope('none', null)).toBe('none:none');
    expect(buildPosterIntegrationScope(undefined, undefined)).toBe('none:none');
  });

  it('differentiates by poster service and key hash', () => {
    const rpdbA = buildPosterIntegrationScope('rpdb', 'key-a');
    const rpdbB = buildPosterIntegrationScope('rpdb', 'key-b');
    const topA = buildPosterIntegrationScope('topPosters', 'key-a');

    expect(rpdbA).not.toBe(rpdbB);
    expect(rpdbA).not.toBe(topA);
  });

  it('builds distinct top250 cache keys by integration scope', () => {
    const noneScope = buildPosterIntegrationScope('none', null);
    const rpdbScope = buildPosterIntegrationScope('rpdb', 'secret-key');

    const noneKey = buildImdbEnrichmentCacheKey('movie', 'top250', {}, null, 0, noneScope, '');
    const rpdbKey = buildImdbEnrichmentCacheKey('movie', 'top250', {}, null, 0, rpdbScope, '');

    expect(noneKey).not.toBe(rpdbKey);
  });
});
