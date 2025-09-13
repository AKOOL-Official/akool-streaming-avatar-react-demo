import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ApiService } from './apiService';
import { StreamProviderType } from './types/streaming.types';

import ConfigurationPanel from './components/ConfigurationPanel';
import NetworkQualityDisplay from './components/NetworkQuality';
import VideoDisplay from './components/VideoDisplay';
import ChatInterface from './components/ChatInterface';
import { NotificationContainer } from './components/NotificationContainer';

import { useStreamingContext } from './hooks/useStreamingContext';
import { useNotifications } from './contexts/NotificationContext';
import { useProviderAudioControls } from './hooks/useProviderAudioControls';
import { useStreamingSession } from './hooks/useStreamingSession';
import { useProviderVideoCamera } from './hooks/useProviderVideoCamera';

const App: React.FC = () => {
  // Provider context
  const { providerType, switchProvider } = useStreamingContext();

  // Notifications
  const { showError } = useNotifications();

  // Media controls (now provider-agnostic)
  const {
    micEnabled,
    setMicEnabled,
    toggleMic,
    cleanup: cleanupAudio,
    noiseReductionEnabled,
    toggleNoiseReduction,
    isDumping,
    dumpAudio,
  } = useProviderAudioControls();

  // Configuration state
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

  // Initialize API service
  useEffect(() => {
    if (openapiHost && openapiToken) {
      const apiService = new ApiService(openapiHost, openapiToken);
      // Set up notification callback for API errors
      apiService.setNotificationCallback((message, title) => {
        showError(message, title);
      });
      setApi(apiService);
    }
  }, [openapiHost, openapiToken, showError]);

  // Camera controls (now provider-agnostic)
  const {
    cameraEnabled,
    localVideoTrack,
    cameraError,
    toggleCamera,
    cleanup: cleanupCamera,
  } = useProviderVideoCamera();

  // Unified streaming hook
  const { isJoined, connected, startStreaming, closeStreaming } = useStreamingSession({
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
    providerType,
  });

  // Auto-cleanup media devices when streaming stops or component unmounts
  useEffect(() => {
    if (!connected) {
      // Cleanup both audio and video when streaming stops
      cleanupAudio();
      cleanupCamera();
    }
  }, [connected, cleanupAudio, cleanupCamera]);

  // Cleanup on component unmount only
  const cleanupAudioRef = useRef(cleanupAudio);
  const cleanupCameraRef = useRef(cleanupCamera);

  // Update refs when cleanup functions change
  cleanupAudioRef.current = cleanupAudio;
  cleanupCameraRef.current = cleanupCamera;

  useEffect(() => {
    return () => {
      cleanupAudioRef.current();
      cleanupCameraRef.current();
    };
  }, []); // Empty dependency array - only runs on mount/unmount

  // Handle provider selection
  const handleProviderChange = async (newProviderType: StreamProviderType) => {
    if (connected) {
      const confirmSwitch = window.confirm(`Switching providers will disconnect the current session. Continue?`);
      if (!confirmSwitch) return;

      await closeStreaming();
    }

    // Provider switching is handled by updating the provider type in the context
    // When startStreaming is called next, it will create a session with the new stream_type
    try {
      await switchProvider(newProviderType);
    } catch (error) {
      showError(`Failed to switch to ${newProviderType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <ConfigurationPanel
        openapiHost={openapiHost}
        setOpenapiHost={setOpenapiHost}
        openapiToken={openapiToken}
        setOpenapiToken={setOpenapiToken}
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
        // Provider selector props
        connected={connected}
        onProviderChange={handleProviderChange}
      />

      <div className="right-side">
        <VideoDisplay
          isJoined={isJoined}
          avatarVideoUrl={avatarVideoUrl}
          localVideoTrack={localVideoTrack}
          cameraEnabled={cameraEnabled}
        />

        <ChatInterface
          connected={connected}
          micEnabled={micEnabled}
          setMicEnabled={setMicEnabled}
          toggleMic={toggleMic}
          cameraEnabled={cameraEnabled}
          toggleCamera={toggleCamera}
          cameraError={cameraError}
          noiseReductionEnabled={noiseReductionEnabled}
          toggleNoiseReduction={toggleNoiseReduction}
          isDumping={isDumping}
          dumpAudio={dumpAudio}
          onSystemMessageCallback={(callback) => {
            systemMessageCallbackRef.current = callback;
          }}
        />

        {isJoined && <NetworkQualityDisplay />}
      </div>

      <NotificationContainer />
    </>
  );
};

export default App;
