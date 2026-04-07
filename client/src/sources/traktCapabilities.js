export const TRAKT_BROWSE_TYPES = [
  { value: 'discover', label: 'Discover' },
  { value: 'community', label: 'Community' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'other', label: 'Other' },
];

const BROWSE_TYPE_OPTIONS = {
  discover: ['trending', 'popular', 'anticipated', 'recommended'],
  community: ['favorited', 'watched', 'played', 'collected'],
  calendar: ['calendar', 'recently_aired'],
  other: ['boxoffice'],
};

const PERIOD_LIST_TYPES = new Set(['recommended', 'favorited', 'watched', 'played', 'collected']);
const CALENDAR_LIST_TYPES = new Set(['calendar', 'recently_aired']);
const NON_FILTER_LIST_TYPES = new Set(['boxoffice', 'list']);
const DIRECT_EXTERNAL_RATING_FILTER_LIST_TYPES = new Set([
  'trending',
  'popular',
  'anticipated',
  'recommended',
  'favorited',
  'watched',
  'played',
  'collected',
]);

const EMPTY_EXTERNAL_FILTER_SUPPORT = Object.freeze({
  imdbRatings: false,
  tmdbRatings: false,
  rtMeters: false,
  rtUserMeters: false,
  metascores: false,
  imdbVotes: false,
  tmdbVotes: false,
});

const MOVIE_EXTERNAL_FILTER_SUPPORT = Object.freeze({
  imdbRatings: true,
  tmdbRatings: true,
  rtMeters: true,
  rtUserMeters: true,
  metascores: true,
  imdbVotes: true,
  tmdbVotes: true,
});

const SERIES_EXTERNAL_FILTER_SUPPORT = Object.freeze({
  imdbRatings: true,
  tmdbRatings: true,
  rtMeters: false,
  rtUserMeters: false,
  metascores: false,
  imdbVotes: true,
  tmdbVotes: true,
});

const CALENDAR_MOVIE_EXTERNAL_FILTER_SUPPORT = Object.freeze({
  imdbRatings: true,
  tmdbRatings: true,
  rtMeters: true,
  rtUserMeters: true,
  metascores: false,
  imdbVotes: true,
  tmdbVotes: true,
});

const CALENDAR_SERIES_EXTERNAL_FILTER_SUPPORT = Object.freeze({
  imdbRatings: false,
  tmdbRatings: true,
  rtMeters: false,
  rtUserMeters: false,
  metascores: false,
  imdbVotes: false,
  tmdbVotes: true,
});

function humanize(value) {
  return String(value)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getDaysUntilEndOfYearUtc() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const endOfYear = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(Math.floor((endOfYear.getTime() - today.getTime()) / dayMs) + 1, 1);
}

export function normalizeTraktListType(listType) {
  if (!listType) return 'calendar';
  if (listType === 'community_stats') return 'watched';
  return listType;
}

export function getBrowseTypeForListType(listType) {
  const normalized = normalizeTraktListType(listType);
  const match = Object.entries(BROWSE_TYPE_OPTIONS).find(([, values]) =>
    values.includes(normalized)
  );
  return match?.[0] || 'discover';
}

function getOptionLabel(value, listTypes, communityMetrics) {
  const fromListTypes = listTypes.find((item) => item.value === value)?.label;
  if (fromListTypes) return fromListTypes;

  const fromCommunityMetrics = communityMetrics.find((item) => item.value === value)?.label;
  if (fromCommunityMetrics) return fromCommunityMetrics;

  return humanize(value);
}

export function getListTypeOptionsForBrowseType({
  browseType,
  listTypes = [],
  communityMetrics = [],
  isMovie = true,
}) {
  const values = BROWSE_TYPE_OPTIONS[browseType] || [];
  return values
    .filter((value) => isMovie || value !== 'boxoffice')
    .map((value) => ({
      value,
      label: getOptionLabel(value, listTypes, communityMetrics),
    }));
}

export function getAvailableBrowseTypes({ listTypes = [], communityMetrics = [], isMovie = true }) {
  return TRAKT_BROWSE_TYPES.filter(
    (browseType) =>
      getListTypeOptionsForBrowseType({
        browseType: browseType.value,
        listTypes,
        communityMetrics,
        isMovie,
      }).length > 0
  );
}

export function getDefaultListTypeForBrowseType({
  browseType,
  listTypes = [],
  communityMetrics = [],
  isMovie = true,
}) {
  const options = getListTypeOptionsForBrowseType({
    browseType,
    listTypes,
    communityMetrics,
    isMovie,
  });
  return options[0]?.value || 'calendar';
}

export function supportsTraktPeriod(listType) {
  return PERIOD_LIST_TYPES.has(normalizeTraktListType(listType));
}

export function supportsTraktCalendarSettings(listType) {
  return CALENDAR_LIST_TYPES.has(normalizeTraktListType(listType));
}

export function supportsTraktAdvancedFilters(listType) {
  return !NON_FILTER_LIST_TYPES.has(normalizeTraktListType(listType));
}

export function getTraktExternalRatingFilterSupport(listType, catalogType = 'movie') {
  const normalized = normalizeTraktListType(listType);
  const isMovie = catalogType === 'movie';

  if (CALENDAR_LIST_TYPES.has(normalized)) {
    return isMovie
      ? { ...CALENDAR_MOVIE_EXTERNAL_FILTER_SUPPORT }
      : { ...CALENDAR_SERIES_EXTERNAL_FILTER_SUPPORT };
  }

  if (DIRECT_EXTERNAL_RATING_FILTER_LIST_TYPES.has(normalized)) {
    return isMovie ? { ...MOVIE_EXTERNAL_FILTER_SUPPORT } : { ...SERIES_EXTERNAL_FILTER_SUPPORT };
  }

  return { ...EMPTY_EXTERNAL_FILTER_SUPPORT };
}

export function supportsTraktDirectExternalRatingFilters(listType, catalogType = 'movie') {
  const support = getTraktExternalRatingFilterSupport(listType, catalogType);
  return Object.values(support).some(Boolean);
}

export function supportsTraktCoreRatingVoteFilters(listType) {
  const normalized = normalizeTraktListType(listType);
  return normalized !== 'list';
}

export function formatTraktCalendarWindowLabel(listType, days) {
  const normalized = normalizeTraktListType(listType);
  const numericDays = Number(days);
  if (!Number.isFinite(numericDays) || numericDays <= 0) return '';

  if (normalized === 'calendar') {
    if (numericDays === 7) return 'Next Week Releases';
    if (numericDays === 30) return 'Next Month';
    if (numericDays === getDaysUntilEndOfYearUtc()) return 'This Year';
    return `Next ${numericDays} days`;
  }

  return `Last ${numericDays} days`;
}
