import { useState, useEffect, useRef } from 'react';
import './App.css';
import { ApiService } from './apiService';
// StreamProviderType will be used when we add provider-specific logic

import ConfigurationPanel from './components/ConfigurationPanel';
import NetworkQualityDisplay from './components/NetworkQuality';
import VideoDisplay from './components/VideoDisplay';
import ChatInterface from './components/ChatInterface';
import { useUnifiedStreamingContext } from './contexts/UnifiedStreamingContext';
import { useAgora } from './contexts/AgoraContext';
import { useLiveKit } from './contexts/LiveKitContext';
import { useUnifiedAudioControls } from './hooks/useUnifiedAudioControls';
import { useUnifiedStreaming } from './hooks/useUnifiedStreaming';
import { useUnifiedVideoCamera } from './hooks/useUnifiedVideoCamera';

function App() {
  const { streamType, setStreamType } = useUnifiedStreamingContext();
  const { client } = useAgora();
  const { room } = useLiveKit();
  const [modeType, setModeType] = useState(Number(import.meta.env.VITE_MODE_TYPE) || 2);
  const [language, setLanguage] = useState(import.meta.env.VITE_LANGUAGE || 'en');
  const [voiceId, setVoiceId] = useState(import.meta.env.VITE_VOICE_ID || '');
  const [backgroundUrl, setBackgroundUrl] = useState(import.meta.env.VITE_BACKGROUND_URL || '');
  const [voiceUrl, setVoiceUrl] = useState(import.meta.env.VITE_VOICE_URL || '');
  const [voiceParams, setVoiceParams] = useState<Record<string, unknown>>({});

  const [openapiHost, setOpenapiHost] = useState(import.meta.env.VITE_OPENAPI_HOST || '');
  const [avatarId, setAvatarId] = useState(import.meta.env.VITE_AVATAR_ID || '');
  const [knowledgeId, setKnowledgeId] = useState('');
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(import.meta.env.VITE_AVATAR_VIDEO_URL || '');

  const [openapiToken, setOpenapiToken] = useState(import.meta.env.VITE_OPENAPI_TOKEN || '');
  const [sessionDuration, setSessionDuration] = useState(10);
  const [api, setApi] = useState<ApiService | null>(null);

  // Ref to store the system message callback
  const systemMessageCallbackRef = useRef<
    ((messageId: string, text: string, systemType: string, metadata?: Record<string, unknown>) => void) | null
  >(null);

  useEffect(() => {
    if (openapiHost && openapiToken) {
      setApi(new ApiService(openapiHost, openapiToken));
    }
  }, [openapiHost, openapiToken]);

  // Initialize camera hook first as its localVideoTrack is needed by streaming
  const { cameraEnabled, localVideoTrack, cameraError, toggleCamera, cleanup: cleanupCamera } = useUnifiedVideoCamera(streamType);

  const {
    isJoined,
    connected,
    remoteStats,
    startStreaming,
    closeStreaming,
    sendMessage,
    sendInterrupt,
  } = useUnifiedStreaming(
    streamType,
    avatarId,
    knowledgeId,
    sessionDuration,
    voiceId,
    voiceUrl,
    backgroundUrl,
    language,
    modeType,
    voiceParams,
    api,
    localVideoTrack,
    systemMessageCallbackRef.current || undefined,
  );

  // Initialize audio controls 
  const { micEnabled, setMicEnabled, toggleMic, cleanup: cleanupAudio } = useUnifiedAudioControls(streamType);

  // Auto-cleanup media devices when streaming stops
  useEffect(() => {
    if (!connected) {
      // Cleanup both audio and video when streaming stops
      if (micEnabled) {
        cleanupAudio();
      }
      if (cameraEnabled) {
        cleanupCamera();
      }
    }
  }, [connected, micEnabled, cameraEnabled, cleanupAudio, cleanupCamera]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      cleanupCamera();
    };
  }, [cleanupAudio, cleanupCamera]);

  return (
    <>
      <ConfigurationPanel
        openapiHost={openapiHost}
        setOpenapiHost={setOpenapiHost}
        openapiToken={openapiToken}
        setOpenapiToken={setOpenapiToken}
        streamType={streamType}
        setStreamType={setStreamType}
        sessionDuration={sessionDuration}
        setSessionDuration={setSessionDuration}
        modeType={modeType}
        setModeType={setModeType}
        avatarId={avatarId}
        setAvatarId={setAvatarId}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        language={language}
        setLanguage={setLanguage}
        backgroundUrl={backgroundUrl}
        setBackgroundUrl={setBackgroundUrl}
        voiceUrl={voiceUrl}
        setVoiceUrl={setVoiceUrl}
        knowledgeId={knowledgeId}
        setKnowledgeId={setKnowledgeId}
        voiceParams={voiceParams}
        setVoiceParams={setVoiceParams}
        isJoined={isJoined}
        startStreaming={startStreaming}
        closeStreaming={closeStreaming}
        api={api}
        setAvatarVideoUrl={setAvatarVideoUrl}
      />
      <div className="right-side">
        <VideoDisplay
          isJoined={isJoined}
          avatarVideoUrl={avatarVideoUrl}
          localVideoTrack={localVideoTrack}
          cameraEnabled={cameraEnabled}
          streamType={streamType}
        />
        <ChatInterface
          client={streamType === 'agora' ? client : null}
          room={streamType === 'livekit' ? room : null}
          connected={connected}
          micEnabled={micEnabled}
          setMicEnabled={setMicEnabled}
          toggleMic={toggleMic}
          cameraEnabled={cameraEnabled}
          toggleCamera={toggleCamera}
          cameraError={cameraError}
          streamType={streamType}
          sendMessage={sendMessage}
          sendInterrupt={sendInterrupt}
          onSystemMessageCallback={(callback) => {
            systemMessageCallbackRef.current = callback;
          }}
        />
        <div>{isJoined && remoteStats && <NetworkQualityDisplay stats={remoteStats} />}</div>
      </div>
    </>
  );
}

export default App;
