import React from 'react';
import { IconButton } from '../shared';
import { SystemEventType } from '../../hooks/useMessageState';
import { useStreamingContext } from '../../hooks/useStreamingContext';
import { logger } from '../../core/Logger';

interface ChatControlsProps {
  connected: boolean;
  micEnabled: boolean;
  setMicEnabled: (enabled: boolean) => void;
  toggleMic?: () => Promise<void>;
  cameraEnabled: boolean;
  toggleCamera: () => Promise<void>;
  cameraError?: string | null;
  noiseReductionEnabled: boolean;
  toggleNoiseReduction: () => Promise<void>;
  isDumping: boolean;
  dumpAudio: () => Promise<void>;
  inputMessage: string;
  setInputMessage: (message: string) => void;
  sendMessage: () => void;
  addSystemMessage: (
    messageId: string,
    text: string,
    systemType: SystemEventType,
    metadata?: Record<string, unknown>,
  ) => void;
}

export const ChatControls: React.FC<ChatControlsProps> = ({
  connected,
  micEnabled,
  setMicEnabled,
  toggleMic,
  cameraEnabled,
  toggleCamera,
  cameraError,
  noiseReductionEnabled,
  toggleNoiseReduction,
  isDumping,
  dumpAudio,
  inputMessage,
  setInputMessage,
  sendMessage,
  addSystemMessage,
}) => {
  // Check if debug features should be shown (default: false)
  const showDebugFeatures = import.meta.env.VITE_DEBUG_FEATURES === 'true';
  const { sendInterrupt } = useStreamingContext();

  const toggleMicInternal = async () => {
    if (toggleMic) {
      // Add system message for user audio state change (before toggle)
      if (micEnabled) {
        addSystemMessage(`mic_${Date.now()}`, '🔇 User microphone disabled', SystemEventType.MIC_END);
      } else {
        addSystemMessage(`mic_${Date.now()}`, '🎤 User microphone enabled', SystemEventType.MIC_START);
      }
      await toggleMic();
      return;
    }

    // Fallback implementation if toggleMic is not provided
    if (!micEnabled) {
      setMicEnabled(true);
      addSystemMessage(`mic_${Date.now()}`, '🎤 User microphone enabled', SystemEventType.MIC_START);
    } else {
      setMicEnabled(false);
      addSystemMessage(`mic_${Date.now()}`, '🔇 User microphone disabled', SystemEventType.MIC_END);
    }
  };

  const toggleCameraInternal = async () => {
    if (!connected) return;

    try {
      // Add system message for video state change (before toggle)
      if (cameraEnabled) {
        addSystemMessage(`camera_${Date.now()}`, '📷 User camera disabled', SystemEventType.CAMERA_END);
      } else {
        addSystemMessage(`camera_${Date.now()}`, '📹 User camera enabled', SystemEventType.CAMERA_START);
      }

      // Toggle the camera
      await toggleCamera();
    } catch (error) {
      logger.error('Failed to toggle camera', { error });
    }
  };

  const handleSendInterrupt = async () => {
    // Add system message for interrupt
    addSystemMessage(`interrupt_${Date.now()}`, '🛑 User interrupted response', SystemEventType.INTERRUPT);
    try {
      await sendInterrupt();
    } catch (error) {
      logger.error('Failed to send interrupt', { error });
    }
  };

  return (
    <div className="chat-input">
      <IconButton
        icon={micEnabled ? 'mic' : 'mic_off'}
        onClick={toggleMicInternal}
        disabled={!connected}
        title={micEnabled ? 'Disable microphone' : 'Enable microphone'}
      />

      {showDebugFeatures && (
        <IconButton
          icon={noiseReductionEnabled ? 'noise_control_off' : 'noise_aware'}
          onClick={toggleNoiseReduction}
          disabled={!connected || !micEnabled}
          variant="noise-reduction"
          active={noiseReductionEnabled}
          title={
            !micEnabled
              ? 'Enable microphone first to use noise reduction'
              : noiseReductionEnabled
                ? 'Disable noise reduction'
                : 'Enable noise reduction'
          }
        />
      )}

      {showDebugFeatures && (
        <IconButton
          icon={isDumping ? 'download' : 'file_download'}
          onClick={dumpAudio}
          disabled={!connected || !micEnabled || isDumping}
          variant="audio-dump"
          active={isDumping}
          loading={isDumping}
          title={isDumping ? 'Dumping audio data...' : 'Dump audio data for analysis (downloads 9 files)'}
        />
      )}

      <IconButton
        icon={cameraEnabled ? 'videocam' : 'videocam_off'}
        onClick={toggleCameraInternal}
        disabled={!connected}
        variant={cameraError ? 'error' : 'default'}
        title={cameraError || (cameraEnabled ? 'Disable camera' : 'Enable camera')}
      />

      {!micEnabled && (
        <>
          <input
            type="text"
            placeholder={'Type a message...'}
            disabled={!connected}
            className={!connected ? 'disabled' : ''}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && sendMessage()}
          />

          <IconButton icon="send" onClick={sendMessage} disabled={!connected} title="Send message" />

          <IconButton icon="stop" onClick={handleSendInterrupt} disabled={!connected} title="Interrupt response" />
        </>
      )}
    </div>
  );
};

export default ChatControls;
