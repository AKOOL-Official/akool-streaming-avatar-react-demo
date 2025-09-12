import { useState, useCallback, useRef } from 'react';
import { AudioTrack } from '../types/streaming.types';
import { useStreamingContext } from '../contexts/StreamingContext';
import { logger } from '../core/Logger';

// Provider-agnostic audio controls interface
export interface UseProviderAudioControlsReturn {
  micEnabled: boolean;
  setMicEnabled: (enabled: boolean) => void;
  toggleMic: () => Promise<void>;
  cleanup: () => Promise<void>;

  // Extended functionality
  noiseReductionEnabled: boolean;
  toggleNoiseReduction: () => Promise<void>;
  isDumping: boolean;
  dumpAudio: () => Promise<void>;

  // Provider-agnostic audio track
  audioTrack: AudioTrack | null;
}

export const useProviderAudioControls = (): UseProviderAudioControlsReturn => {
  const { provider, publishAudio, unpublishAudio } = useStreamingContext();

  const [micEnabled, setMicEnabled] = useState(false);
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(false);
  const [isDumping, setIsDumping] = useState(false);
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);

  const audioTrackRef = useRef<unknown | null>(null); // Provider-specific track object

  const toggleMic = useCallback(async () => {
    if (!provider) {
      logger.error('No provider available for audio controls');
      return;
    }

    try {
      if (!micEnabled) {
        // Create and publish audio track through provider
        logger.info('Enabling microphone through provider', { providerType: provider.providerType });

        // For now, we'll delegate to the current Agora implementation
        // TODO: Implement provider-specific audio track creation
        const track: AudioTrack = {
          id: `audio-${Date.now()}`,
          kind: 'audio',
          enabled: true,
          muted: false,
          volume: 1.0,
        };

        setAudioTrack(track);
        await publishAudio(track);
        setMicEnabled(true);

        logger.info('Microphone enabled successfully');
      } else {
        // Unpublish and stop audio track
        logger.info('Disabling microphone through provider');

        if (audioTrack) {
          await unpublishAudio();
        }

        setAudioTrack(null);
        setMicEnabled(false);

        logger.info('Microphone disabled successfully');
      }
    } catch (error) {
      logger.error('Failed to toggle microphone', { error });
      throw error;
    }
  }, [provider, micEnabled, audioTrack, publishAudio, unpublishAudio]);

  const toggleNoiseReduction = useCallback(async () => {
    try {
      logger.info('Toggling noise reduction', { current: noiseReductionEnabled });

      // TODO: Implement provider-specific noise reduction
      setNoiseReductionEnabled((prev) => !prev);

      logger.info('Noise reduction toggled', { enabled: !noiseReductionEnabled });
    } catch (error) {
      logger.error('Failed to toggle noise reduction', { error });
    }
  }, [noiseReductionEnabled]);

  const dumpAudio = useCallback(async () => {
    try {
      logger.info('Starting audio dump');
      setIsDumping(true);

      // TODO: Implement provider-specific audio dumping
      // Simulate dumping process
      setTimeout(() => {
        setIsDumping(false);
        logger.info('Audio dump completed');
      }, 2000);
    } catch (error) {
      logger.error('Failed to dump audio', { error });
      setIsDumping(false);
    }
  }, []);

  const cleanup = useCallback(async () => {
    try {
      logger.info('Cleaning up audio controls');

      if (micEnabled && audioTrack) {
        await unpublishAudio();
      }

      setMicEnabled(false);
      setAudioTrack(null);
      setNoiseReductionEnabled(false);
      setIsDumping(false);
      audioTrackRef.current = null;

      logger.info('Audio controls cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup audio controls', { error });
    }
  }, [micEnabled, audioTrack, unpublishAudio]);

  return {
    micEnabled,
    setMicEnabled,
    toggleMic,
    cleanup,

    noiseReductionEnabled,
    toggleNoiseReduction,
    isDumping,
    dumpAudio,

    audioTrack,
  };
};
