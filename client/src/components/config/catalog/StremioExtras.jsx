import { memo, useCallback, useMemo } from 'react';

const AVAILABLE_EXTRAS = [
  {
    id: 'genre',
    label: 'Genre (default)',
    description: 'Standard Stremio genre dropdown',
  },
  {
    id: 'year',
    label: 'Year',
    description: 'Use the dropdown values as years',
  },
  {
    id: 'sortBy',
    label: 'Sort By',
    description: 'Use the dropdown values as sort options',
  },
  {
    id: 'certification',
    label: 'Age Rating',
    description: 'Use the dropdown values as certifications',
  },
];

const DEFAULT_EXTRA_IDS = ['genre', 'year', 'sortBy', 'certification'];

export const StremioExtras = memo(function StremioExtras({
  localCatalog,
  onFiltersChange,
  availableModes = DEFAULT_EXTRA_IDS,
}) {
  const allowedModes = useMemo(() => {
    const modeSet = new Set(
      Array.isArray(availableModes) && availableModes.length > 0
        ? availableModes
        : DEFAULT_EXTRA_IDS
    );
    return AVAILABLE_EXTRAS.filter((extra) => modeSet.has(extra.id));
  }, [availableModes]);

  const fallbackMode = allowedModes[0]?.id || 'genre';
  const selectedModeRaw =
    localCatalog?.filters?.stremioExtraMode ||
    localCatalog?.filters?.stremioExtras?.[0] ||
    fallbackMode;
  const selectedMode = allowedModes.some((extra) => extra.id === selectedModeRaw)
    ? selectedModeRaw
    : fallbackMode;

  const selectMode = useCallback(
    (id) => {
      onFiltersChange('stremioExtraMode', id);
      onFiltersChange('stremioExtras', [id]);
    },
    [onFiltersChange]
  );

  if (allowedModes.length === 0) {
    return null;
  }

  return (
    <div className="stremio-extras">
      <p className="stremio-extras-hint">
        {allowedModes.length === 1
          ? 'This source supports the Stremio dropdown as a genre selector.'
          : 'Choose what the single Stremio dropdown should control for this catalog. Genre is the default and most compatible option.'}
      </p>
      <div className="stremio-extras-grid">
        {allowedModes.map((extra) => {
          const isSelected = selectedMode === extra.id;
          return (
            <button
              key={extra.id}
              type="button"
              className={`stremio-extra-chip ${isSelected ? 'active' : ''}`}
              onClick={() => selectMode(extra.id)}
            >
              <span className="stremio-extra-chip-label">{extra.label}</span>
              <span className="stremio-extra-chip-desc">{extra.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
