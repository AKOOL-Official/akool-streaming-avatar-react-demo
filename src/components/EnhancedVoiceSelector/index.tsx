import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedVoice, VoiceGroup } from '../../types/api.schemas';
import { ApiService } from '../../apiService';
import VoiceGroupComponent from '../VoiceGroup';
import './styles.css';

interface EnhancedVoiceSelectorProps {
  voiceId: string;
  setVoiceId: (id: string) => void;
  voiceUrl: string;
  setVoiceUrl: (url: string) => void;
  apiService: ApiService;
  disabled?: boolean;
}

interface VoiceFilters {
  language: string;
  gender: string;
  age: string;
}

const EnhancedVoiceSelector: React.FC<EnhancedVoiceSelectorProps> = ({
  voiceId,
  setVoiceId,
  voiceUrl,
  setVoiceUrl,
  apiService,
  disabled = false,
}) => {
  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<VoiceFilters>({
    language: '',
    gender: '',
    age: '',
  });
  const [useManualVoiceId, setUseManualVoiceId] = useState(false);
  const [voiceUrlInput, setVoiceUrlInput] = useState(voiceUrl);
  const [voiceIdInput, setVoiceIdInput] = useState(voiceId);
  const [showFilters, setShowFilters] = useState(false);

  // Sync local voice URL input with prop
  useEffect(() => {
    setVoiceUrlInput(voiceUrl);
  }, [voiceUrl]);

  // Sync local voice ID input with prop
  useEffect(() => {
    setVoiceIdInput(voiceId);
  }, [voiceId]);

  // Load voice groups
  const loadVoiceGroups = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const groups = await apiService.getAllVoices();
      setVoiceGroups(groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voices');
    } finally {
      setLoading(false);
    }
  }, [apiService]);

  // Load voices on component mount
  useEffect(() => {
    loadVoiceGroups();
  }, [loadVoiceGroups]);

  // Handle voice selection
  const handleVoiceSelect = useCallback(
    (voice: EnhancedVoice) => {
      setVoiceId(voice.voice_id);
    },
    [setVoiceId],
  );

  // Handle manual voice ID input
  const handleVoiceIdChange = useCallback(
    (value: string) => {
      setVoiceIdInput(value);
      setVoiceId(value);
    },
    [setVoiceId],
  );

  // Handle voice URL input
  const handleVoiceUrlChange = useCallback(
    (value: string) => {
      setVoiceUrlInput(value);
      setVoiceUrl(value);
    },
    [setVoiceUrl],
  );

  // Handle filter changes
  const handleFilterChange = useCallback((key: keyof VoiceFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({
      language: '',
      gender: '',
      age: '',
    });
    setSearchQuery('');
  }, []);

  // Get unique filter options
  const getFilterOptions = useCallback(() => {
    const languages = new Set<string>();
    const genders = new Set<string>();
    const ages = new Set<string>();

    if (voiceGroups && voiceGroups.length > 0) {
      voiceGroups.forEach((group) => {
        if (group.voices && group.voices.length > 0) {
          group.voices.forEach((voice) => {
            if (voice.language) languages.add(voice.language);
            if (voice.gender) genders.add(voice.gender);
            if (voice.age && Array.isArray(voice.age)) {
              voice.age.forEach((age) => ages.add(age));
            }
          });
        }
      });
    }

    return {
      languages: Array.from(languages).sort(),
      genders: Array.from(genders).sort(),
      ages: Array.from(ages).sort(),
    };
  }, [voiceGroups]);

  const filterOptions = getFilterOptions();

  return (
    <div className="enhanced-voice-selector">
      <div className="selector-header">
        <h3 className="selector-title">Voice Selection</h3>
        <div className="selector-actions">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="filter-toggle-button"
            disabled={disabled}
            title={showFilters ? 'Hide filters' : 'Show filters'}
          >
            <span className="material-icons">filter_list</span>
            Filters
          </button>
          <button
            onClick={loadVoiceGroups}
            disabled={disabled || loading}
            className="refresh-button"
            title="Refresh voice list"
          >
            <span className="material-icons">refresh</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-and-filters">
        <div className="search-container">
          <div className="search-input-wrapper">
            <span className="material-icons search-icon">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voices by name, language, or description..."
              disabled={disabled}
              className="search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="clear-search-button" title="Clear search">
                <span className="material-icons">close</span>
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="filters-container">
            <div className="filter-row">
              <div className="filter-group">
                <label className="filter-label">Language:</label>
                <select
                  value={filters.language}
                  onChange={(e) => handleFilterChange('language', e.target.value)}
                  disabled={disabled}
                  className="filter-select"
                >
                  <option value="">All Languages</option>
                  {filterOptions.languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Gender:</label>
                <select
                  value={filters.gender}
                  onChange={(e) => handleFilterChange('gender', e.target.value)}
                  disabled={disabled}
                  className="filter-select"
                >
                  <option value="">All Genders</option>
                  {filterOptions.genders.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Age:</label>
                <select
                  value={filters.age}
                  onChange={(e) => handleFilterChange('age', e.target.value)}
                  disabled={disabled}
                  className="filter-select"
                >
                  <option value="">All Ages</option>
                  {filterOptions.ages.map((age) => (
                    <option key={age} value={age}>
                      {age}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={clearFilters}
                disabled={disabled}
                className="clear-filters-button"
                title="Clear all filters"
              >
                <span className="material-icons">clear</span>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Input Toggle */}
      <div className="manual-input-section">
        <div className="input-mode-toggle">
          <button
            onClick={() => setUseManualVoiceId(!useManualVoiceId)}
            className="toggle-button"
            disabled={disabled}
            title={useManualVoiceId ? 'Switch to voice selection' : 'Switch to manual input'}
          >
            <span className="material-icons">{useManualVoiceId ? 'list' : 'edit'}</span>
            {useManualVoiceId ? 'Voice Selection' : 'Manual Input'}
          </button>
        </div>

        {useManualVoiceId && (
          <div className="manual-inputs">
            <div className="input-group">
              <label className="input-label">Voice ID:</label>
              <input
                type="text"
                value={voiceIdInput}
                onChange={(e) => setVoiceIdInput(e.target.value)}
                onBlur={(e) => handleVoiceIdChange(e.target.value)}
                placeholder="Enter voice ID"
                disabled={disabled}
                className="manual-input"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Voice URL:</label>
              <input
                type="text"
                value={voiceUrlInput}
                onChange={(e) => setVoiceUrlInput(e.target.value)}
                onBlur={(e) => handleVoiceUrlChange(e.target.value)}
                placeholder="Enter voice URL"
                disabled={disabled}
                className="manual-input"
              />
            </div>
          </div>
        )}
      </div>

      {/* Voice Groups */}
      {!useManualVoiceId && (
        <div className="voice-groups-container">
          {loading && (
            <div className="loading-container">
              <span className="material-icons loading-icon">hourglass_empty</span>
              <p>Loading voices...</p>
            </div>
          )}

          {error && (
            <div className="error-container">
              <span className="material-icons error-icon">error</span>
              <p>{error}</p>
              <button onClick={loadVoiceGroups} className="retry-button">
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && voiceGroups && voiceGroups.length > 0 && (
            <div className="voice-groups">
              {voiceGroups.map((group) => (
                <VoiceGroupComponent
                  key={group.type}
                  group={group}
                  selectedVoiceId={voiceId}
                  onVoiceSelect={handleVoiceSelect}
                  disabled={disabled}
                  searchQuery={searchQuery}
                  filters={filters}
                />
              ))}
            </div>
          )}

          {!loading && !error && voiceGroups && voiceGroups.length === 0 && (
            <div className="no-voices-container">
              <span className="material-icons">mic_off</span>
              <p>No voices available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedVoiceSelector;
