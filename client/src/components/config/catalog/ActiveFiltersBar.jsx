import { memo } from 'react';
import { X } from 'lucide-react';
import { SmoothExpand } from '../../layout/SmoothExpand';

export const ActiveFiltersBar = memo(function ActiveFiltersBar({
  activeFilters,
  onClearFilter,
  onClearAll,
  onToggleSection,
}) {
  const hasFilters = activeFilters.length > 0;

  return (
    <SmoothExpand show={hasFilters}>
      <div className="active-filters-bar" style={{ marginBottom: 16 }}>
        <div className="active-filters-chips">
          {activeFilters.map((filter) => (
            <div key={filter.key} className="active-filter-chip" data-section={filter.section}>
              <button
                type="button"
                className="active-filter-chip-label"
                onClick={() => onToggleSection(filter.section)}
                aria-label={`Show ${filter.label} section`}
              >
                {filter.label}
              </button>
              <button
                type="button"
                className="chip-remove"
                aria-label={`Remove ${filter.label} filter`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilter(filter.key);
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button className="clear-all-btn" onClick={onClearAll}>
          Clear All
        </button>
      </div>
    </SmoothExpand>
  );
});
