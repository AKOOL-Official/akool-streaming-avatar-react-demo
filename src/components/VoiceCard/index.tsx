import React from 'react';
import { EnhancedVoice } from '../../types/api.schemas';
import VoicePreview from '../VoicePreview';
import './styles.css';

interface VoiceCardProps {
  voice: EnhancedVoice;
  isSelected: boolean;
  onSelect: (voice: EnhancedVoice) => void;
  disabled?: boolean;
}

const VoiceCard: React.FC<VoiceCardProps> = ({ voice, isSelected, onSelect, disabled = false }) => {
  const handleSelect = () => {
    if (!disabled) {
      onSelect(voice);
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getVoiceTypeBadge = (type: 1 | 2) => {
    return type === 1 ? 'VoiceClone' : 'Akool';
  };

  const getVoiceTypeColor = (type: 1 | 2) => {
    return type === 1 ? '#52c41a' : '#4096ff';
  };

  return (
    <div
      className={`voice-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleSelect}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      }}
      aria-label={`Select voice: ${voice.name || 'Unnamed Voice'}`}
    >
      <div className="voice-card-header">
        <div className="voice-name-container">
          <h4 className="voice-name">{voice.name || 'Unnamed Voice'}</h4>
          <span className="voice-type-badge" style={{ backgroundColor: getVoiceTypeColor(voice.type) }}>
            {getVoiceTypeBadge(voice.type)}
          </span>
        </div>
        <VoicePreview previewUrl={voice.preview || ''} voiceName={voice.name || 'Unnamed Voice'} disabled={disabled} />
      </div>

      <div className="voice-card-content">
        <div className="voice-info-grid">
          <div className="voice-info-item">
            <span className="info-label">Language:</span>
            <span className="info-value">
              {voice.language || 'N/A'} {voice.locale ? `(${voice.locale})` : ''}
            </span>
          </div>

          <div className="voice-info-item">
            <span className="info-label">Gender:</span>
            <span className="info-value">{voice.gender || 'N/A'}</span>
          </div>

          <div className="voice-info-item">
            <span className="info-label">Age:</span>
            <span className="info-value">{voice.age && Array.isArray(voice.age) ? voice.age.join(', ') : 'N/A'}</span>
          </div>

          <div className="voice-info-item">
            <span className="info-label">Model:</span>
            <span className="info-value">{voice.voice_model_name || 'N/A'}</span>
          </div>
        </div>

        {voice.duration && (
          <div className="voice-info-item">
            <span className="info-label">Duration:</span>
            <span className="info-value">{formatDuration(voice.duration)}</span>
          </div>
        )}

        {((voice.style && Array.isArray(voice.style) && voice.style.length > 0) ||
          (voice.scenario && Array.isArray(voice.scenario) && voice.scenario.length > 0)) && (
          <div className="voice-tags">
            {voice.style && Array.isArray(voice.style) && voice.style.length > 0 && (
              <div className="tag-group">
                <span className="tag-label">Style:</span>
                <div className="tags">
                  {voice.style.map((style, index) => (
                    <span key={index} className="tag style-tag">
                      {style}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {voice.scenario && Array.isArray(voice.scenario) && voice.scenario.length > 0 && (
              <div className="tag-group">
                <span className="tag-label">Scenario:</span>
                <div className="tags">
                  {voice.scenario.map((scenario, index) => (
                    <span key={index} className="tag scenario-tag">
                      {scenario}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {voice.text && (
          <div className="voice-sample">
            <span className="sample-label">Sample Text:</span>
            <p className="sample-text">"{voice.text}"</p>
          </div>
        )}
      </div>

      <div className="voice-card-footer">
        <div className="voice-id">
          <span className="id-label">Voice ID:</span>
          <code className="id-value">{voice.voice_id || 'N/A'}</code>
        </div>
      </div>
    </div>
  );
};

export default VoiceCard;
