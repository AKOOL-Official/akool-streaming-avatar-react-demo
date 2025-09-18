import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedVoice, VoiceGroup } from '../../types/api.schemas';
import { ApiService } from '../../apiService';
import VoiceGroupComponent from '../VoiceGroup';
import './styles.css';

interface VoiceSelectorDialogProps {
  voiceId: string;
  setVoiceId: (id: string) => void;
  apiService: ApiService;
  disabled?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

interface VoiceFilters {
  language: string;
  gender: string;
  age: string;
}

const VoiceSelectorDialog: React.FC<VoiceSelectorDialogProps> = ({
  voiceId,
  setVoiceId,
  apiService,
  disabled = false,
  isOpen,
  onClose,
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
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(voiceId);

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

  // Load voice groups when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadVoiceGroups();
    }
  }, [isOpen, loadVoiceGroups]);

  // Sync local selected voice with prop when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedVoiceId(voiceId);
    }
  }, [isOpen, voiceId]);

  // Handle escape key to close dialog
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle voice selection
  const handleVoiceSelect = useCallback((voice: EnhancedVoice) => {
    setSelectedVoiceId(voice.voice_id);
  }, []);

  // Handle confirm selection
  const handleConfirm = useCallback(() => {
    if (selectedVoiceId) {
      setVoiceId(selectedVoiceId);
    }
    onClose();
  }, [selectedVoiceId, setVoiceId, onClose]);

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

  // Get selected voice name
  const getSelectedVoiceName = useCallback(() => {
    if (!selectedVoiceId || !voiceGroups.length) return '';

    for (const group of voiceGroups) {
      if (group.voices) {
        const selectedVoice = group.voices.find((voice) => voice.voice_id === selectedVoiceId);
        if (selectedVoice) {
          return selectedVoice.name || 'Unnamed Voice';
        }
      }
    }
    return selectedVoiceId; // Fallback to ID if name not found
  }, [selectedVoiceId, voiceGroups]);

  const selectedVoiceName = getSelectedVoiceName();

  if (!isOpen) return null;

  return (
    <div className="voice-selector-dialog-overlay" onClick={onClose}>
      <div className="voice-selector-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Select Voice</h2>
          <div className="dialog-actions">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary btn-sm"
              disabled={disabled}
              title={showFilters ? 'Hide filters' : 'Show filters'}
            >
              <span className="material-icons">filter_list</span>
              Filters
            </button>
            <button
              onClick={loadVoiceGroups}
              disabled={disabled || loading}
              className="btn btn-icon btn-sm"
              title="Refresh voice list"
            >
              <span className="material-icons">refresh</span>
            </button>
            <button onClick={onClose} className="btn btn-icon btn-sm" title="Close dialog">
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        <div className="dialog-content">
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
                  <button
                    onClick={() => setSearchQuery('')}
                    className="btn btn-icon btn-sm clear-search-button"
                    title="Clear search"
                  >
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
                    className="btn btn-secondary btn-sm"
                    title="Clear all filters"
                  >
                    <span className="material-icons">clear</span>
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Voice Groups */}
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
                <button onClick={loadVoiceGroups} className="btn btn-primary btn-sm">
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
                    selectedVoiceId={selectedVoiceId}
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
        </div>

        <div className="dialog-footer">
          <div className="selected-voice-info">
            {selectedVoiceId && (
              <div className="selected-voice">
                <span className="selected-label">Selected Voice:</span>
                <span className="selected-value">{selectedVoiceName}</span>
                {selectedVoiceName !== selectedVoiceId && <code className="selected-id">ID: {selectedVoiceId}</code>}
              </div>
            )}
          </div>
          <div className="dialog-buttons">
            <button onClick={onClose} className="btn btn-secondary btn-md">
              Cancel
            </button>
            <button onClick={handleConfirm} className="btn btn-primary btn-md" disabled={!selectedVoiceId}>
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSelectorDialog;
