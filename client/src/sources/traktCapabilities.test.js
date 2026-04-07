import { describe, it, expect } from 'vitest';
import {
  formatTraktCalendarWindowLabel,
  getAvailableBrowseTypes,
  getBrowseTypeForListType,
  getTraktExternalRatingFilterSupport,
  supportsTraktCoreRatingVoteFilters,
  supportsTraktDirectExternalRatingFilters,
  getDefaultListTypeForBrowseType,
  getListTypeOptionsForBrowseType,
  normalizeTraktListType,
  supportsTraktAdvancedFilters,
  supportsTraktCalendarSettings,
  supportsTraktPeriod,
} from './traktCapabilities';

const listTypes = [
  { value: 'trending', label: 'Trending Now' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'anticipated', label: 'Most Anticipated' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'favorited', label: 'Most Favorited' },
  { value: 'calendar', label: 'Calendar (Upcoming)' },
  { value: 'recently_aired', label: 'Recently Aired' },
  { value: 'boxoffice', label: 'Box Office' },
];

const communityMetrics = [
  { value: 'watched', label: 'Unique Viewers' },
  { value: 'played', label: 'Total Plays' },
  { value: 'collected', label: 'Library Adds' },
];

describe('traktCapabilities', () => {
  it('normalizes community_stats to watched', () => {
    expect(normalizeTraktListType('community_stats')).toBe('watched');
    expect(normalizeTraktListType(undefined)).toBe('calendar');
  });

  it('resolves browse type by list type', () => {
    expect(getBrowseTypeForListType('recommended')).toBe('discover');
    expect(getBrowseTypeForListType('played')).toBe('community');
    expect(getBrowseTypeForListType('recently_aired')).toBe('calendar');
    expect(getBrowseTypeForListType('boxoffice')).toBe('other');
  });

  it('builds community options from metrics labels', () => {
    const options = getListTypeOptionsForBrowseType({
      browseType: 'community',
      listTypes,
      communityMetrics,
      isMovie: true,
    });

    expect(options.map((o) => o.value)).toEqual(['favorited', 'watched', 'played', 'collected']);
    expect(options.find((o) => o.value === 'watched')?.label).toBe('Unique Viewers');
  });

  it('hides movie-only browse options for series', () => {
    const browseTypes = getAvailableBrowseTypes({
      listTypes,
      communityMetrics,
      isMovie: false,
    });

    expect(browseTypes.map((o) => o.value)).not.toContain('other');
  });

  it('returns default option per browse type', () => {
    const defaultCommunity = getDefaultListTypeForBrowseType({
      browseType: 'community',
      listTypes,
      communityMetrics,
      isMovie: true,
    });

    expect(defaultCommunity).toBe('favorited');
  });

  it('exposes option capability checks', () => {
    expect(supportsTraktPeriod('recommended')).toBe(true);
    expect(supportsTraktPeriod('popular')).toBe(false);
    expect(supportsTraktCalendarSettings('calendar')).toBe(true);
    expect(supportsTraktCalendarSettings('trending')).toBe(false);
    expect(supportsTraktAdvancedFilters('boxoffice')).toBe(false);
    expect(supportsTraktAdvancedFilters('trending')).toBe(true);
    expect(supportsTraktDirectExternalRatingFilters('calendar', 'movie')).toBe(true);
    expect(supportsTraktDirectExternalRatingFilters('calendar', 'series')).toBe(true);
    expect(supportsTraktDirectExternalRatingFilters('trending', 'movie')).toBe(true);
    expect(supportsTraktDirectExternalRatingFilters('boxoffice', 'movie')).toBe(false);
    expect(supportsTraktCoreRatingVoteFilters('boxoffice')).toBe(true);
    expect(supportsTraktCoreRatingVoteFilters('list')).toBe(false);
  });

  it('returns media-type-aware external rating support matrix', () => {
    expect(getTraktExternalRatingFilterSupport('calendar', 'movie')).toMatchObject({
      imdbRatings: true,
      tmdbRatings: true,
      rtMeters: true,
      rtUserMeters: true,
      metascores: false,
      imdbVotes: true,
      tmdbVotes: true,
    });

    expect(getTraktExternalRatingFilterSupport('calendar', 'series')).toMatchObject({
      imdbRatings: false,
      tmdbRatings: true,
      rtMeters: false,
      rtUserMeters: false,
      metascores: false,
      imdbVotes: false,
      tmdbVotes: true,
    });

    expect(getTraktExternalRatingFilterSupport('trending', 'series')).toMatchObject({
      imdbRatings: true,
      tmdbRatings: true,
      rtMeters: false,
      rtUserMeters: false,
      metascores: false,
      imdbVotes: true,
      tmdbVotes: true,
    });
  });

  it('formats calendar window labels by list type semantics', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endOfYear = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
    const daysToYearEnd = Math.max(
      Math.floor((endOfYear.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) + 1,
      1
    );

    expect(formatTraktCalendarWindowLabel('calendar', 7)).toBe('Next Week Releases');
    expect(formatTraktCalendarWindowLabel('calendar', 30)).toBe('Next Month');
    expect(formatTraktCalendarWindowLabel('calendar', daysToYearEnd)).toBe('This Year');
    expect(formatTraktCalendarWindowLabel('recently_aired', 30)).toBe('Last 30 days');
  });
});
