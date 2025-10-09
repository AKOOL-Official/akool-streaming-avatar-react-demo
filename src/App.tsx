import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ApiService } from './apiService';

import ConfigurationPanel from './components/ConfigurationPanel';
import NetworkQualityDisplay from './components/NetworkQuality';
import VideoDisplay from './components/VideoDisplay';
import ChatInterface from './components/ChatInterface';
import { NotificationContainer } from './components/NotificationContainer';
import ModalContainer from './components/ModalContainer';

import { useStreamingContext } from './hooks/useStreamingContext';
import { useNotifications } from './contexts/NotificationContext';
import { useProviderAudioControls } from './hooks/useProviderAudioControls';
import { useStreamingSession } from './hooks/useStreamingSession';
import { useProviderVideoCamera } from './hooks/useProviderVideoCamera';
import { useConfigurationStore } from './stores/configurationStore';

const App: React.FC = () => {
  // Configuration from store
  const {
    openapiHost,
    openapiToken,
    avatarId,
    knowledgeId,
    sessionDuration,
    voiceId,
    voiceUrl,
    backgroundUrl,
    language,
    modeType,
    voiceParams,
  } = useConfigurationStore();

  // Provider context
  const { providerType } = useStreamingContext();

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

  // Local state for API service and video URL
  const [api, setApi] = useState<ApiService | null>(null);
  const [avatarVideoUrl] = useState(import.meta.env.VITE_AVATAR_VIDEO_URL || '');

  // Ref to store the system message callback
  const systemMessageCallbackRef = useRef<
    ((messageId: string, text: string, systemType: string, metadata?: Record<string, unknown>) => void) | null
  >(null);

  // Initialize API service when credentials change
  useEffect(() => {
    if (openapiHost && openapiToken) {
      const apiService = new ApiService(openapiHost, openapiToken);
      // Set up notification callback for API errors
      apiService.setNotificationCallback((message, title) => {
        showError(message, title);
      });
      setApi(apiService);
    } else {
      setApi(null);
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

  // Unified streaming hook - now uses store configuration
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

  return (
    <>
      <ConfigurationPanel
        isJoined={isJoined}
        startStreaming={startStreaming}
        closeStreaming={closeStreaming}
        api={api}
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

      {/* Modal Container - Renders all modals at App level for proper centering */}
      <ModalContainer api={api} />
    </>
  );
};

export default App;
