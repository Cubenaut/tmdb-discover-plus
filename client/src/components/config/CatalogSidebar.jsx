import {
  Plus,
  Film,
  Tv,
  TrendingUp,
  Flame,
  Calendar,
  Star,
  Play,
  Radio,
  Sparkles,
  ChevronDown,
  Shuffle,
  Download,
  Upload,
  Trophy,
  Award,
  EyeOff,
  Settings,
  LayoutList,
  Coffee,
  Heart,
} from 'lucide-react';
import { DiscordIcon } from '../social/DiscordButton.jsx';
import { useState, useEffect, lazy, Suspense, memo } from 'react';

import { useIsMobile } from '../../hooks/useIsMobile';
import { useCatalog, useTMDBData, useAppActions } from '../../context/AppContext';
import { CatalogListSkeleton } from '../layout/Skeleton';
import { GeneralSettingsSection } from './GeneralSettingsSection';
import { DonateModal } from '../modals/DonateModal';
import { PosterSettingsSection } from './PosterSettingsSection';
import { ImportSelectModal } from '../modals/ImportSelectModal';
import { ExportSelectModal } from '../modals/ExportSelectModal';

const DraggableCatalogList = lazy(() =>
  import('./DraggableCatalogList').then((m) => ({ default: m.DraggableCatalogList }))
);

const presetIcons = {
  trending_day: Flame,
  trending_week: TrendingUp,
  now_playing: Play,
  upcoming: Calendar,
  airing_today: Radio,
  on_the_air: Radio,
  top_rated: Star,
  popular: Sparkles,
};

export const CatalogSidebar = memo(function CatalogSidebar() {
  const {
    catalogs,
    activeCatalog,
    setActiveCatalog: onSelectCatalog,
    globalSource,
    setGlobalSource,
    configName,
    setConfigName: onConfigNameChange,
    preferences,
    setPreferences: onPreferencesChange,
    handleAddPresetCatalog: onAddPresetCatalog,
    handleDeleteCatalog: onDeleteCatalog,
    handleDuplicateCatalog: onDuplicateCatalog,
    handleImportConfig: onImportConfig,
    setCatalogs,
  } = useCatalog();
  const {
    presetCatalogs = { movie: [], series: [] },
    imdbPresetCatalogs = [],
    imdbEnabled = false,
  } = useTMDBData();
  const { addToast, setShowNewCatalogModal } = useAppActions();

  const onAddCatalog = () => setShowNewCatalogModal(true);
  const onReorderCatalogs = (nextCatalogs) => {
    setCatalogs(nextCatalogs);
  };
  const safeCatalogs = Array.isArray(catalogs) ? catalogs : [];
  const safePresetCatalogs =
    presetCatalogs && typeof presetCatalogs === 'object' && !Array.isArray(presetCatalogs)
      ? presetCatalogs
      : { movie: [], series: [] };
  const isMobile = useIsMobile();
  const [moviePresetsCollapsed, setMoviePresetsCollapsed] = useState(isMobile);
  const [tvPresetsCollapsed, setTvPresetsCollapsed] = useState(isMobile);
  const [sidebarTab, setSidebarTab] = useState('catalogs');
  const [importData, setImportData] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isDonateOpen, setIsDonateOpen] = useState(false);

  useEffect(() => {
    setMoviePresetsCollapsed(isMobile);
    setTvPresetsCollapsed(isMobile);
  }, [isMobile]);

  // Sync global source if active catalog changes
  useEffect(() => {
    if (activeCatalog?.source) {
      if (activeCatalog.source !== globalSource) {
        setGlobalSource(activeCatalog.source);
      }
    }
  }, [activeCatalog, globalSource, setGlobalSource]);

  const getCatalogKey = (catalog) => String(catalog?._id || catalog?.id || catalog?.name);

  const getPlaceholder = () => {
    if (safeCatalogs.length > 0 && safeCatalogs[0].name) {
      return safeCatalogs[0].name;
    }
    return 'Untitled Config';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-actions">
          <div className="config-name-wrapper">
            <input
              type="text"
              className="config-name-input"
              value={configName}
              onChange={(e) => onConfigNameChange && onConfigNameChange(e.target.value)}
              placeholder={getPlaceholder()}
            />
          </div>
          <button
            className="btn btn-primary btn-sm sidebar-add-btn"
            onClick={onAddCatalog}
            title="Add custom catalog"
          >
            <Plus size={16} /> <span>New Catalog</span>
          </button>
        </div>
      </div>

      <div className="sidebar-support sidebar-support--top">
        <div className="sidebar-support-links">
          <a
            href="https://discord.gg/X2N3btmEG2"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-support-btn sidebar-support-discord"
            title="Join our Discord community"
          >
            <DiscordIcon className="sidebar-support-icon" />
            <span>Discord</span>
          </a>
          <button
            onClick={() => setIsDonateOpen(true)}
            className="sidebar-support-btn sidebar-support-donate"
            title="Donate"
          >
            <Heart size={14} />
            <span>Donate</span>
          </button>
        </div>
      </div>

      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${sidebarTab === 'catalogs' ? 'active' : ''}`}
          onClick={() => setSidebarTab('catalogs')}
        >
          <LayoutList size={14} />
          Catalogs
        </button>
        <button
          className={`sidebar-tab ${sidebarTab === 'settings' ? 'active' : ''}`}
          onClick={() => setSidebarTab('settings')}
        >
          <Settings size={14} />
          Settings
        </button>
      </div>

      {sidebarTab === 'settings' && (
        <>
          <div className="sidebar-controls">
            <div className="sidebar-actions-row">
              <button
                className="btn btn-secondary btn-sm sidebar-action-btn"
                title="Export configuration"
                onClick={() => setShowExportModal(true)}
              >
                <Upload size={14} />
                <span>Export</span>
              </button>

              <label
                className="btn btn-secondary btn-sm sidebar-action-btn"
                title="Import configuration"
              >
                <Download size={14} />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const imported = JSON.parse(event.target.result);
                        if (
                          imported?.catalogs?.length ||
                          imported?.preferences ||
                          imported?.configName
                        ) {
                          setImportData(imported);
                          setShowImportModal(true);
                        } else {
                          if (addToast) addToast('No catalogs or settings found in file', 'error');
                        }
                      } catch (err) {
                        console.error('Import failed', err);
                        if (addToast) addToast('Failed to parse JSON file', 'error');
                      }
                      e.target.value = '';
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>

            <label
              className="sidebar-checkbox"
              title="Randomize catalog order every time Stremio loads"
            >
              <input
                type="checkbox"
                checked={!!preferences?.shuffleCatalogs}
                onChange={(e) =>
                  onPreferencesChange({ ...preferences, shuffleCatalogs: e.target.checked })
                }
              />
              <Shuffle size={14} />
              <span>Shuffle Catalogs</span>
            </label>

            <div className="search-providers">
              <div className="search-providers-header">
                <span className="search-providers-label">Search Integration</span>
              </div>
              <label className="sidebar-checkbox" title="Disable all search catalogs">
                <input
                  type="checkbox"
                  checked={!!preferences?.disableSearch}
                  onChange={(e) =>
                    onPreferencesChange({ ...preferences, disableSearch: e.target.checked })
                  }
                />
                <EyeOff size={14} />
                <span>Disable All Search</span>
              </label>

              {!preferences?.disableSearch && (
                <>
                  <span className="search-providers-label" style={{ fontSize: '0.65rem' }}>
                    Active Search Providers
                  </span>
                  <div className="provider-toggles">
                    <button
                      type="button"
                      className={`provider-toggle ${preferences?.disableTmdbSearch !== true ? 'active' : ''}`}
                      onClick={() =>
                        onPreferencesChange({
                          ...preferences,
                          disableTmdbSearch: preferences?.disableTmdbSearch !== true,
                        })
                      }
                      title="Toggle TMDB Search"
                    >
                      TMDB
                    </button>
                    <button
                      type="button"
                      className={`provider-toggle ${preferences?.disableImdbSearch === false ? 'active' : ''}`}
                      onClick={() =>
                        onPreferencesChange({
                          ...preferences,
                          disableImdbSearch: preferences?.disableImdbSearch === false,
                        })
                      }
                      title="Toggle IMDb Search"
                    >
                      IMDb
                    </button>
                    <button
                      type="button"
                      className={`provider-toggle ${preferences?.disableAnilistSearch === false ? 'active' : ''}`}
                      onClick={() =>
                        onPreferencesChange({
                          ...preferences,
                          disableAnilistSearch: preferences?.disableAnilistSearch === false,
                        })
                      }
                      title="Toggle AniList Search"
                    >
                      AniList
                    </button>
                    <button
                      type="button"
                      className={`provider-toggle ${preferences?.disableMalSearch === false ? 'active' : ''}`}
                      onClick={() =>
                        onPreferencesChange({
                          ...preferences,
                          disableMalSearch: preferences?.disableMalSearch === false,
                        })
                      }
                      title="Toggle MAL Search"
                    >
                      MAL
                    </button>
                    <button
                      type="button"
                      className={`provider-toggle ${preferences?.disableSimklSearch === false ? 'active' : ''}`}
                      onClick={() =>
                        onPreferencesChange({
                          ...preferences,
                          disableSimklSearch: preferences?.disableSimklSearch === false,
                        })
                      }
                      title="Toggle Simkl Search"
                    >
                      Simkl
                    </button>
                    <button
                      type="button"
                      className={`provider-toggle ${preferences?.disableTraktSearch === false ? 'active' : ''}`}
                      onClick={() =>
                        onPreferencesChange({
                          ...preferences,
                          disableTraktSearch: preferences?.disableTraktSearch === false,
                        })
                      }
                      title="Toggle Trakt Search"
                    >
                      Trakt
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <GeneralSettingsSection />

          <PosterSettingsSection />
        </>
      )}

      {sidebarTab === 'catalogs' && (
        <>
          <div className="catalog-list">
            {safeCatalogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Film size={32} />
                </div>
                <p>No catalogs yet</p>
                <p className="text-sm">Add a custom catalog or use presets below</p>
              </div>
            ) : (
              <Suspense fallback={<CatalogListSkeleton count={safeCatalogs.length || 3} />}>
                <DraggableCatalogList
                  catalogs={safeCatalogs}
                  activeCatalog={activeCatalog}
                  onSelectCatalog={onSelectCatalog}
                  onDeleteCatalog={onDeleteCatalog}
                  onDuplicateCatalog={onDuplicateCatalog}
                  onReorderCatalogs={onReorderCatalogs}
                  getCatalogKey={getCatalogKey}
                />
              </Suspense>
            )}
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Quick Add Presets</h4>

            {imdbEnabled && (
              <div className="source-tabs" style={{ marginBottom: '12px' }}>
                <button
                  type="button"
                  className={`source-tab ${globalSource === 'tmdb' ? 'active tmdb' : ''}`}
                  onClick={() => setGlobalSource('tmdb')}
                >
                  <Film size={14} /> TMDB
                </button>
                <button
                  type="button"
                  className={`source-tab ${globalSource === 'imdb' ? 'active imdb' : ''}`}
                  onClick={() => setGlobalSource('imdb')}
                >
                  <Award size={14} /> IMDb
                </button>
              </div>
            )}

            {/* Unified Movie Presets */}
            <div className={`preset-group ${moviePresetsCollapsed ? 'collapsed' : ''}`}>
              <div
                className="preset-group-header"
                onClick={() => setMoviePresetsCollapsed(!moviePresetsCollapsed)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMoviePresetsCollapsed(!moviePresetsCollapsed);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Film size={14} />
                <span>Movies</span>
                <ChevronDown size={14} className="chevron" />
              </div>
              <div className="preset-list">
                {(globalSource === 'tmdb'
                  ? safePresetCatalogs.movie || []
                  : imdbPresetCatalogs.filter((p) => p.type === 'movie')
                ).map((preset) => {
                  const source = globalSource === 'tmdb' ? 'tmdb' : 'imdb';
                  const type = 'movie';
                  const isAdded = safeCatalogs.some(
                    (c) =>
                      (source === 'imdb'
                        ? c.source === 'imdb'
                        : !c.source || c.source === 'tmdb') &&
                      c.filters?.listType === preset.value &&
                      c.type === type
                  );
                  const IconComponent =
                    presetIcons[preset.value] ||
                    (source === 'imdb' && preset.value === 'top250' ? Trophy : Star);

                  return (
                    <button
                      key={`${source}-${preset.value}`}
                      className={`preset-item ${source === 'imdb' ? 'preset-item--imdb' : ''} ${isAdded ? 'added' : ''}`}
                      onClick={() => !isAdded && onAddPresetCatalog(type, preset, source)}
                      disabled={isAdded}
                      title={isAdded ? 'Already added' : preset.description}
                    >
                      <IconComponent size={14} />
                      <span>{preset.label.replace(/^[^\s]+\s/, '')}</span>
                      {!isAdded && <Plus size={14} className="preset-add-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Unified TV Presets */}
            <div className={`preset-group ${tvPresetsCollapsed ? 'collapsed' : ''}`}>
              <div
                className="preset-group-header"
                onClick={() => setTvPresetsCollapsed(!tvPresetsCollapsed)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTvPresetsCollapsed(!tvPresetsCollapsed);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Tv size={14} />
                <span>TV Shows</span>
                <ChevronDown size={14} className="chevron" />
              </div>
              <div className="preset-list">
                {(globalSource === 'tmdb'
                  ? safePresetCatalogs.series || []
                  : imdbPresetCatalogs.filter((p) => p.type === 'series')
                ).map((preset) => {
                  const source = globalSource === 'tmdb' ? 'tmdb' : 'imdb';
                  const type = 'series';
                  const isAdded = safeCatalogs.some(
                    (c) =>
                      (source === 'imdb'
                        ? c.source === 'imdb'
                        : !c.source || c.source === 'tmdb') &&
                      c.filters?.listType === preset.value &&
                      c.type === type
                  );
                  const IconComponent =
                    presetIcons[preset.value] ||
                    (source === 'imdb' && preset.value === 'top250' ? Trophy : Star);

                  return (
                    <button
                      key={`${source}-${preset.value}`}
                      className={`preset-item ${source === 'imdb' ? 'preset-item--imdb' : ''} ${isAdded ? 'added' : ''}`}
                      onClick={() => !isAdded && onAddPresetCatalog(type, preset, source)}
                      disabled={isAdded}
                      title={isAdded ? 'Already added' : preset.description}
                    >
                      <IconComponent size={14} />
                      <span>{preset.label.replace(/^[^\s]+\s/, '')}</span>
                      {!isAdded && <Plus size={14} className="preset-add-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {showImportModal && importData && (
        <ImportSelectModal
          isOpen={showImportModal}
          data={importData}
          onClose={() => {
            setShowImportModal(false);
            setImportData(null);
          }}
          onConfirm={(selectedData) => {
            if (onImportConfig) onImportConfig(selectedData);
            setShowImportModal(false);
            setImportData(null);
          }}
        />
      )}
      {showExportModal && (
        <ExportSelectModal
          isOpen={showExportModal}
          catalogs={safeCatalogs}
          configName={configName}
          preferences={preferences}
          onClose={() => setShowExportModal(false)}
          onConfirm={(exportData) => {
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(configName || 'stremio_config').replace(/\s+/g, '_')}_export.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setShowExportModal(false);
            if (addToast) addToast('Configuration exported successfully');
          }}
        />
      )}
      <DonateModal isOpen={isDonateOpen} onClose={() => setIsDonateOpen(false)} />
    </aside>
  );
});
