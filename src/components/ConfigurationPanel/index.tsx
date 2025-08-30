import { useState, useEffect } from 'react';
import { ApiService, Language, Voice, Avatar } from '../../apiService';
import { StreamProviderType } from '../../types/streamingProvider';
import { useNotifications } from '../../hooks/useNotifications';
import AvatarSelector from '../AvatarSelector';
import VoiceSelector from '../VoiceSelector';
import JsonEditorModal from '../JsonEditorModal';
import './styles.css';

interface ConfigurationPanelProps {
  api: ApiService | null | undefined;
  openapiHost: string;
  setOpenapiHost: (host: string) => void;
  openapiToken: string;
  setOpenapiToken: (token: string) => void;
  streamType: StreamProviderType;
  setStreamType: (type: StreamProviderType) => void;
  sessionDuration: number;
  setSessionDuration: (duration: number) => void;
  modeType: number;
  setModeType: (mode: number) => void;
  avatarId: string;
  setAvatarId: (id: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
  voiceId: string;
  setVoiceId: (id: string) => void;
  voiceUrl: string;
  setVoiceUrl: (url: string) => void;
  backgroundUrl: string;
  setBackgroundUrl: (url: string) => void;
  knowledgeId: string;
  setKnowledgeId: (id: string) => void;
  voiceParams: Record<string, unknown>;
  setVoiceParams: (params: Record<string, unknown>) => void;
  isJoined: boolean;
  startStreaming: () => Promise<void>;
  closeStreaming: () => Promise<void>;
  setAvatarVideoUrl: (url: string) => void;
}

export default function ConfigurationPanel({
  api,
  openapiHost,
  setOpenapiHost,
  openapiToken,
  setOpenapiToken,
  streamType,
  setStreamType,
  sessionDuration,
  setSessionDuration,
  modeType,
  setModeType,
  avatarId,
  setAvatarId,
  language,
  setLanguage,
  voiceId,
  setVoiceId,
  voiceUrl,
  setVoiceUrl,
  backgroundUrl,
  setBackgroundUrl,
  knowledgeId,
  setKnowledgeId,
  voiceParams,
  setVoiceParams,
  isJoined,
  startStreaming,
  closeStreaming,
  setAvatarVideoUrl,
}: ConfigurationPanelProps) {
  const { showError } = useNotifications();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [backgroundUrlInput, setBackgroundUrlInput] = useState(backgroundUrl);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!api) return;
      try {
        const [langList, voiceList, avatarList] = await Promise.all([
          api.getLangList(),
          api.getVoiceList(),
          api.getAvatarList(),
        ]);
        setLanguages(langList);
        setVoices(voiceList);
        setAvatars(avatarList);
      } catch (error) {
        console.error('Error fetching language and voice data:', error);
        showError(error instanceof Error ? error.message : 'Failed to load configuration data', {
          title: 'Configuration Error',
        });
      }
    };

    fetchData();
  }, [api, showError]);

  // Sync local background URL input with prop
  useEffect(() => {
    setBackgroundUrlInput(backgroundUrl);
  }, [backgroundUrl]);

  const handleOpenJsonModal = () => {
    setIsJsonModalOpen(true);
  };

  const handleCloseJsonModal = () => {
    setIsJsonModalOpen(false);
  };

  const handleJsonModalSave = (newParams: Record<string, unknown>) => {
    setVoiceParams(newParams);
  };

  const handleStartStreaming = async () => {
    setIsStarting(true);
    try {
      await startStreaming();
    } catch (error) {
      console.error('Error starting streaming:', error);
      showError(error instanceof Error ? error.message : 'Failed to start streaming', { title: 'Streaming Error' });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="left-side">
      <h3>Streaming Avatar Demo</h3>

      {/* Connection Settings */}
      <div className="config-group">
        <div className="group-header">Connection</div>
        <div>
          <label>
            Host:
            <input defaultValue={openapiHost} onChange={(e) => setOpenapiHost(e.target.value)} disabled={isJoined} />
          </label>
        </div>
        <div>
          <label>
            Token:
            <input defaultValue={openapiToken} onChange={(e) => setOpenapiToken(e.target.value)} disabled={isJoined} />
          </label>
        </div>
        <div>
          <label>
            Streaming Provider:
            <select
              value={streamType}
              onChange={(e) => setStreamType(e.target.value as StreamProviderType)}
              disabled={isJoined}
            >
              <option value="agora">Agora RTC</option>
              <option value="livekit">LiveKit</option>
              <option value="trtc" disabled>
                TRTC (Coming Soon)
              </option>
            </select>
          </label>
        </div>
      </div>

      {/* Avatar & Media Settings */}
      <div className="config-group">
        <div className="group-header">Avatar & Media</div>
        <AvatarSelector
          api={api}
          avatarId={avatarId}
          setAvatarId={setAvatarId}
          avatars={avatars}
          setAvatars={setAvatars}
          setAvatarVideoUrl={setAvatarVideoUrl}
          disabled={isJoined}
        />
        <div>
          <label>
            Background URL:
            <input
              type="text"
              value={backgroundUrlInput}
              onChange={(e) => setBackgroundUrlInput(e.target.value)}
              onBlur={(e) => setBackgroundUrl(e.target.value)}
              placeholder="Enter background image/video URL"
            />
          </label>
        </div>

        <div>
          <label>
            Language:
            <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={!languages.length}>
              <option value="">Select a language</option>
              {languages.map((lang) => (
                <option key={lang.lang_code} value={lang.lang_code}>
                  {lang.lang_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <VoiceSelector
          voiceId={voiceId}
          setVoiceId={setVoiceId}
          voices={voices}
          voiceUrl={voiceUrl}
          setVoiceUrl={setVoiceUrl}
        />

        <div>
          <label>
            Voice Parameters (JSON):
            <div className={`json-preview-container clickable`} onClick={handleOpenJsonModal} title={'Click to edit'}>
              <div className="json-preview">
                <pre className="json-preview-content">
                  {Object.keys(voiceParams).length === 0 ? '{}' : JSON.stringify(voiceParams, null, 2)}
                </pre>
                <div className="json-preview-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Click to edit
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Session Settings */}
      <div className="config-group">
        <div className="group-header">Session</div>
        <div>
          <label>
            Session Duration (minutes):
            <input
              type="number"
              min="1"
              max="60"
              value={sessionDuration}
              onChange={(e) => setSessionDuration(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isJoined}
            />
          </label>
        </div>
        <div>
          <label>
            ModeType:
            <select value={modeType} onChange={(e) => setModeType(parseInt(e.target.value))}>
              <option value="1">Repeat</option>
              <option value="2">Dialogue</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            Knowledge ID:
            <input
              type="text"
              value={knowledgeId}
              onChange={(e) => setKnowledgeId(e.target.value)}
              placeholder="Enter knowledge ID"
              disabled={isJoined}
            />
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="config-group">
        <div className="buttons">
          {isJoined ? (
            <button onClick={closeStreaming} className="button-off">
              Close Streaming
            </button>
          ) : (
            <button onClick={handleStartStreaming} className="button-on" disabled={isStarting}>
              {isStarting ? 'Requesting...' : 'Start Streaming'}
            </button>
          )}
        </div>
      </div>

      {/* JSON Editor Modal */}
      <JsonEditorModal
        isOpen={isJsonModalOpen}
        onClose={handleCloseJsonModal}
        value={voiceParams}
        onChange={handleJsonModalSave}
        title="Voice Parameters Editor"
      />
    </div>
  );
}
