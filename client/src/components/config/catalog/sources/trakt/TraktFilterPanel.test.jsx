import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TraktFilterPanel } from './TraktFilterPanel';

function createProps(filters = {}, onFiltersChange = vi.fn(), catalogType = 'movie') {
  return {
    localCatalog: { type: catalogType, filters },
    onFiltersChange,
    expandedSections: { filters: true, ratings: true },
    onToggleSection: vi.fn(),
    traktGenres: [],
    traktListTypes: [
      { value: 'trending', label: 'Trending Now' },
      { value: 'popular', label: 'Most Popular' },
      { value: 'anticipated', label: 'Most Anticipated' },
      { value: 'recommended', label: 'Recommended' },
      { value: 'favorited', label: 'Most Favorited' },
      { value: 'calendar', label: 'Calendar (Upcoming)' },
      { value: 'recently_aired', label: 'Recently Aired' },
      { value: 'boxoffice', label: 'Box Office' },
    ],
    traktPeriods: [
      { value: 'weekly', label: 'This Week' },
      { value: 'monthly', label: 'This Month' },
    ],
    traktCalendarTypes: [
      { value: 'movies', label: 'Theatrical Movies' },
      { value: 'dvd', label: 'Home Release' },
      { value: 'streaming', label: 'Streaming Premieres' },
      { value: 'shows', label: 'All Shows' },
      { value: 'shows_new', label: 'New Shows' },
      { value: 'shows_premieres', label: 'Season Premieres' },
      { value: 'shows_finales', label: 'Season Finales' },
    ],
    traktShowStatuses: [],
    traktCertificationsMovie: [],
    traktCertificationsSeries: [],
    traktCommunityMetrics: [
      { value: 'watched', label: 'Unique Viewers' },
      { value: 'played', label: 'Total Plays' },
      { value: 'collected', label: 'Library Adds' },
    ],
    traktNetworks: [{ name: 'Netflix', country: 'us', ids: { trakt: 1 } }],
    traktHasKey: true,
    originalLanguages: [],
    countries: [],
  };
}

describe('TraktFilterPanel year range visibility', () => {
  it('shows Year Range for discover browse type', () => {
    render(<TraktFilterPanel {...createProps({ traktListType: 'trending' })} />);

    expect(screen.getByText('Year Range')).toBeInTheDocument();
  });

  it('hides Year Range for calendar browse type', () => {
    render(<TraktFilterPanel {...createProps({ traktListType: 'calendar' })} />);

    expect(screen.queryByText('Year Range')).not.toBeInTheDocument();
  });

  it('clears stale year filters when not in discover browse type', async () => {
    const onFiltersChange = vi.fn();
    render(
      <TraktFilterPanel
        {...createProps(
          {
            traktListType: 'calendar',
            traktYearMin: 2000,
            traktYearMax: 2020,
          },
          onFiltersChange
        )}
      />
    );

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith('traktYearMin', undefined);
      expect(onFiltersChange).toHaveBeenCalledWith('traktYearMax', undefined);
    });
  });

  it('shows calendar movie external filters except Metacritic', () => {
    render(<TraktFilterPanel {...createProps({ traktListType: 'calendar' })} />);

    expect(screen.getByText('IMDb Rating')).toBeInTheDocument();
    expect(screen.getByText('TMDB Rating')).toBeInTheDocument();
    expect(screen.getByText('Rotten Tomatoes (Critics)')).toBeInTheDocument();
    expect(screen.getByText('Rotten Tomatoes (Audience)')).toBeInTheDocument();
    expect(screen.queryByText('Metacritic')).not.toBeInTheDocument();
    expect(screen.getByText('IMDb Min Votes')).toBeInTheDocument();
    expect(screen.getByText('TMDB Min Votes')).toBeInTheDocument();
  });

  it('shows only supported calendar series external filters', () => {
    render(
      <TraktFilterPanel
        {...createProps(
          { traktListType: 'calendar', traktCalendarType: 'shows' },
          vi.fn(),
          'series'
        )}
      />
    );

    expect(screen.queryByText('IMDb Rating')).not.toBeInTheDocument();
    expect(screen.getByText('TMDB Rating')).toBeInTheDocument();
    expect(screen.queryByText('Rotten Tomatoes (Critics)')).not.toBeInTheDocument();
    expect(screen.queryByText('Rotten Tomatoes (Audience)')).not.toBeInTheDocument();
    expect(screen.queryByText('Metacritic')).not.toBeInTheDocument();
    expect(screen.queryByText('IMDb Min Votes')).not.toBeInTheDocument();
    expect(screen.getByText('TMDB Min Votes')).toBeInTheDocument();
  });

  it('shows future-oriented window presets for upcoming calendar', () => {
    render(<TraktFilterPanel {...createProps({ traktListType: 'calendar' })} />);

    expect(screen.getByText('Next Week Releases')).toBeInTheDocument();
    expect(screen.getByText('Next Month')).toBeInTheDocument();
    expect(screen.getByText('This Year')).toBeInTheDocument();
    expect(screen.queryByText('3 Years')).not.toBeInTheDocument();
  });
});
