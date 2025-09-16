import React, { useState, useEffect } from 'react';
import { ApiService, Language, Avatar } from '../../apiService';
import { useConfigurationStore } from '../../stores/configurationStore';
import { useNotifications } from '../../contexts/NotificationContext';
import { useStreamingContext } from '../../hooks/useStreamingContext';
import { useModal } from '../../contexts/ModalContext';
import { ProviderSelector } from '../ProviderSelector';
import './styles.css';

interface ConfigurationPanelProps {
  isJoined: boolean;
  startStreaming: () => Promise<void>;
  closeStreaming: () => Promise<void>;
  api: ApiService | null | undefined;
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ api, isJoined, startStreaming, closeStreaming }) => {
  const { showError } = useNotifications();
  const { switchProvider } = useStreamingContext();
  const { openVoiceDialog, openJsonEditor } = useModal();

  // Configuration from store
  const {
    // OpenAPI settings
    openapiHost,
    setOpenapiHost,
    openapiToken,
    setOpenapiToken,

    // Avatar settings
    avatarId,
    setAvatarId,
    voiceId,
    setVoiceId,
    knowledgeId,
    setKnowledgeId,

    // Session settings
    sessionDuration,
    setSessionDuration,
    modeType,
    setModeType,
    language,
    setLanguage,

    // Background and voice
    backgroundUrl,
    setBackgroundUrl,
    voiceUrl,
    setVoiceUrl,
    voiceParams,
    setVoiceParams,

    // Validation
    isFullyConfigured,
    validateConfiguration,
  } = useConfigurationStore();

  // Local state for API data and UI
  const [languages, setLanguages] = useState<Language[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [backgroundUrlInput, setBackgroundUrlInput] = useState(backgroundUrl);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load API data when API service is available
  useEffect(() => {
    if (!api) return;

    const loadData = async () => {
      try {
        const [languagesData, avatarsData] = await Promise.all([api.getLangList(), api.getAvatarList()]);
        setLanguages(languagesData);
        setAvatars(avatarsData);
      } catch (error) {
        showError('Failed to load configuration data', 'API Error');
      }
    };

    loadData();
  }, [api, showError]);

  // Validate configuration
  useEffect(() => {
    const validation = validateConfiguration();
    setValidationErrors(validation.errors);
  }, [validateConfiguration]);

  // Update background URL input when store changes
  useEffect(() => {
    setBackgroundUrlInput(backgroundUrl);
  }, [backgroundUrl]);

  // Handle start streaming
  const handleStartStreaming = async () => {
    if (!isFullyConfigured()) {
      showError('Please configure all required settings before starting');
      return;
    }

    if (validationErrors.length > 0) {
      showError(`Configuration errors: ${validationErrors.join(', ')}`);
      return;
    }

    setIsStarting(true);
    try {
      await startStreaming();
    } catch (error) {
      showError(`Failed to start streaming: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsStarting(false);
    }
  };

  // Handle background URL change
  const handleBackgroundUrlChange = (url: string) => {
    setBackgroundUrlInput(url);
    setBackgroundUrl(url);
  };

  // Handle voice params change
  const handleVoiceParamsChange = (params: Record<string, unknown>) => {
    setVoiceParams(params);
  };

  return (
    <div className="left-side">
      <h3>Streaming Avatar Demo</h3>

      <div className="scrollable-content">
        {/* CONNECTION Section */}
        <div className="config-group">
          <h4>CONNECTION</h4>

          {/* Provider Selection */}
          <div className="form-row">
            <label>Provider:</label>
            <ProviderSelector
              disabled={isJoined}
              onProviderChange={(providerType) => {
                // Update configuration store (already handled in ProviderSelector)
                // Also update streaming context for immediate UI feedback
                switchProvider(providerType);
              }}
            />
          </div>

          {/* Host */}
          <div className="form-row">
            <label>Host:</label>
            <input
              type="text"
              placeholder="Enter API host"
              value={openapiHost}
              onChange={(e) => setOpenapiHost(e.target.value)}
              disabled={isJoined}
            />
          </div>

          {/* Token */}
          <div className="form-row">
            <label>Token:</label>
            <input
              type="password"
              placeholder="Enter API token"
              value={openapiToken}
              onChange={(e) => setOpenapiToken(e.target.value)}
              disabled={isJoined}
            />
          </div>
        </div>

        {/* AVATAR & MEDIA Section */}
        <div className="config-group">
          <h4>AVATAR & MEDIA</h4>

          {/* Avatar Selection */}
          <div className="form-row">
            <label>Avatar:</label>
            <div className="input-with-buttons">
              <select value={avatarId} onChange={(e) => setAvatarId(e.target.value)} disabled={isJoined}>
                <option value="">Select an avatar</option>
                {avatars.map((avatar) => (
                  <option key={avatar.avatar_id} value={avatar.avatar_id}>
                    {avatar.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  // Refresh avatars
                  if (api) {
                    api.getAvatarList().then(setAvatars).catch(console.error);
                  }
                }}
                className="icon-button-small"
                title="Refresh avatars"
              >
                ↻
              </button>
              <button type="button" className="icon-button-small" title="Edit avatar">
                ✏️
              </button>
            </div>
          </div>

          {/* Background URL */}
          <div className="form-row">
            <label>Background URL:</label>
            <input
              type="url"
              placeholder="Enter background image/video URL"
              value={backgroundUrlInput}
              onChange={(e) => handleBackgroundUrlChange(e.target.value)}
            />
          </div>

          {/* Language */}
          <div className="form-row">
            <label>Language:</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">Select Language</option>
              {languages.map((lang) => (
                <option key={lang.lang_code} value={lang.lang_code}>
                  {lang.lang_name}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Selection */}
          <div className="form-row">
            <label>Voice:</label>
            <div className="input-with-buttons">
              <input
                type="text"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder="Enter voice ID or select from list"
                disabled={isJoined}
                className="voice-input"
              />
              <button
                type="button"
                onClick={openVoiceDialog}
                disabled={isJoined || !api}
                className="btn btn-secondary btn-sm"
                title="Select voice from list"
              >
                <span className="material-icons">list</span>
                Select
              </button>
            </div>
          </div>

          {/* Voice URL */}
          <div className="form-row">
            <label>Voice URL:</label>
            <input
              type="url"
              placeholder="Enter voice URL"
              value={voiceUrl}
              onChange={(e) => setVoiceUrl(e.target.value)}
              disabled={isJoined}
            />
          </div>

          {/* Voice Parameters */}
          <div className="form-row">
            <label>Voice Parameters (JSON):</label>
            <div className="input-with-buttons">
              <input type="text" value={JSON.stringify(voiceParams)} readOnly placeholder="{}" />
              <button
                type="button"
                onClick={() => openJsonEditor(voiceParams, handleVoiceParamsChange, 'Voice Parameters')}
                disabled={isJoined}
                className="edit-json-button"
                title="Edit JSON parameters"
              >
                ✏️
              </button>
            </div>
          </div>
        </div>

        {/* SESSION Section */}
        <div className="config-group">
          <h4>SESSION</h4>

          {/* Session Duration */}
          <div className="form-row">
            <label>Session Duration (minutes):</label>
            <input
              type="number"
              placeholder="Enter duration"
              value={sessionDuration}
              onChange={(e) => setSessionDuration(Number(e.target.value))}
              min="1"
            />
          </div>

          {/* ModeType */}
          <div className="form-row">
            <label>ModeType:</label>
            <select value={modeType} onChange={(e) => setModeType(Number(e.target.value))}>
              <option value={1}>Repeat</option>
              <option value={2}>Dialogue</option>
            </select>
          </div>

          {/* Knowledge ID */}
          <div className="form-row">
            <label>Knowledge ID:</label>
            <input
              type="text"
              placeholder="Enter knowledge ID"
              value={knowledgeId}
              onChange={(e) => setKnowledgeId(e.target.value)}
            />
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div
            className="config-group"
            style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              border: '1px solid #fecaca',
              marginTop: '16px',
            }}
          >
            <h4
              style={{
                color: '#dc2626',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              ⚠️ Configuration Errors:
            </h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                listStyle: 'none',
              }}
            >
              {validationErrors.map((error, index) => (
                <li
                  key={index}
                  style={{
                    marginBottom: '8px',
                    padding: '8px 12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '6px',
                    borderLeft: '3px solid #dc2626',
                    color: '#991b1b',
                    fontSize: '14px',
                  }}
                >
                  • {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Fixed Action Buttons */}
      <div className="fixed-button-area">
        <div className="buttons">
          {!isJoined ? (
            <button
              onClick={handleStartStreaming}
              disabled={!isFullyConfigured() || validationErrors.length > 0 || isStarting}
              className="button-on"
            >
              {isStarting ? 'Starting...' : 'Start Streaming'}
            </button>
          ) : (
            <button onClick={closeStreaming} className="button-off">
              Stop Streaming
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigurationPanel;
