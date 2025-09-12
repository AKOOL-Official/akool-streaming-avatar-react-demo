import { useState, useCallback, useRef } from 'react';
import { AudioTrack } from '../types/streaming.types';
import { useStreamingContext } from './useStreamingContext';
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

        // Use provider-specific audio track creation
        const track = await provider.enableAudio();
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

        // Use provider-specific audio track disabling
        await provider.disableAudio();

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
    if (!provider) {
      logger.error('No provider available for noise reduction');
      return;
    }

    try {
      logger.info('Toggling noise reduction', { current: noiseReductionEnabled });

      if (!noiseReductionEnabled) {
        await provider.enableNoiseReduction();
      } else {
        await provider.disableNoiseReduction();
      }

      setNoiseReductionEnabled((prev) => !prev);
      logger.info('Noise reduction toggled', { enabled: !noiseReductionEnabled });
    } catch (error) {
      logger.error('Failed to toggle noise reduction', { error });
    }
  }, [provider, noiseReductionEnabled]);

  const dumpAudio = useCallback(async () => {
    if (!provider) {
      logger.error('No provider available for audio dumping');
      return;
    }

    try {
      logger.info('Starting audio dump');
      setIsDumping(true);

      await provider.dumpAudio();

      setIsDumping(false);
      logger.info('Audio dump completed');
    } catch (error) {
      logger.error('Failed to dump audio', { error });
      setIsDumping(false);
    }
  }, [provider]);

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
