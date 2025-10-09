import React, { useState } from 'react';
import { VoiceGroup as VoiceGroupType, EnhancedVoice } from '../../types/api.schemas';
import VoiceCard from '../VoiceCard';
import './styles.css';

interface VoiceGroupProps {
  group: VoiceGroupType;
  selectedVoiceId: string | null;
  onVoiceSelect: (voice: EnhancedVoice) => void;
  disabled?: boolean;
  searchQuery?: string;
  filters?: {
    language?: string;
    gender?: string;
    age?: string;
  };
}

const VoiceGroup: React.FC<VoiceGroupProps> = ({
  group,
  selectedVoiceId,
  onVoiceSelect,
  disabled = false,
  searchQuery = '',
  filters = {},
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const filterVoices = (voices: EnhancedVoice[]) => {
    if (!voices || !Array.isArray(voices)) {
      return [];
    }

    return voices.filter((voice) => {
      if (!voice) return false;

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          (voice.name && voice.name.toLowerCase().includes(query)) ||
          (voice.language && voice.language.toLowerCase().includes(query)) ||
          (voice.locale && voice.locale.toLowerCase().includes(query)) ||
          (voice.voice_model_name && voice.voice_model_name.toLowerCase().includes(query)) ||
          (voice.text && voice.text.toLowerCase().includes(query)) ||
          (voice.style &&
            Array.isArray(voice.style) &&
            voice.style.some((style) => style.toLowerCase().includes(query))) ||
          (voice.scenario &&
            Array.isArray(voice.scenario) &&
            voice.scenario.some((scenario) => scenario.toLowerCase().includes(query)));

        if (!matchesSearch) return false;
      }

      // Language filter
      if (filters.language && voice.language !== filters.language) {
        return false;
      }

      // Gender filter
      if (filters.gender && voice.gender !== filters.gender) {
        return false;
      }

      // Age filter
      if (filters.age && (!voice.age || !Array.isArray(voice.age) || !voice.age.includes(filters.age))) {
        return false;
      }

      return true;
    });
  };

  const filteredVoices = filterVoices(group?.voices || []);
  const hasVoices = filteredVoices.length > 0;

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const getGroupIcon = (type: 1 | 2) => {
    return type === 1 ? 'mic' : 'record_voice_over';
  };

  const getGroupColor = (type: 1 | 2) => {
    return type === 1 ? '#52c41a' : '#4096ff';
  };

  if (!group || (!hasVoices && !searchQuery)) {
    return null;
  }

  return (
    <div className="voice-group">
      <div
        className="voice-group-header"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`Toggle ${group.label} voice group`}
      >
        <div className="group-title-container">
          <span className="group-icon" style={{ color: getGroupColor(group.type) }}>
            <span className="material-icons">{getGroupIcon(group.type)}</span>
          </span>
          <h3 className="group-title">{group.label}</h3>
          <span className="voice-count">
            {filteredVoices.length} voice{filteredVoices.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="group-actions">
          <span
            className={`expand-icon ${isExpanded ? 'expanded' : 'collapsed'}`}
            style={{ color: getGroupColor(group.type) }}
          >
            <span className="material-icons">expand_more</span>
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="voice-group-content">
          {hasVoices ? (
            <div className="voice-grid">
              {filteredVoices.map((voice) => (
                <VoiceCard
                  key={voice._id}
                  voice={voice}
                  isSelected={selectedVoiceId === voice.voice_id}
                  onSelect={onVoiceSelect}
                  disabled={disabled}
                />
              ))}
            </div>
          ) : (
            <div className="no-voices-message">
              <span className="material-icons">search_off</span>
              <p>No voices found matching your search criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceGroup;
