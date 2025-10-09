import { Room, LocalAudioTrack, createLocalAudioTrack, AudioCaptureOptions } from 'livekit-client';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import {
  AudioTrack,
  AudioConfig,
  AudioControllerCallbacks,
  AIDenoiserConfig,
  AIDenoiserMode,
  AIDenoiserState,
} from '../../../types/streaming.types';

export class LiveKitAudioController {
  private room: Room;
  private currentTrack: LocalAudioTrack | null = null;
  private isEnabled = false;
  private callbacks: AudioControllerCallbacks = {};
  private aiDenoiserState: AIDenoiserState = {
    isEnabled: false,
    mode: 'default',
    isInitialized: false,
  };
  private krispProcessor: { setEnabled: (enabled: boolean) => void } | null = null; // Will be dynamically imported from @livekit/krisp-noise-filter

  constructor(room: Room) {
    this.room = room;
  }

  setCallbacks(callbacks: AudioControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  // Helper method to convert unified AI denoiser mode to LiveKit mode
  private convertToLiveKitMode(mode: AIDenoiserMode): string {
    switch (mode) {
      case 'nc':
        return 'NC';
      case 'bvc':
        return 'BVC';
      case 'bvc-telephony':
        return 'BVCTelephony';
      case 'nsng':
      case 'stationary':
      case 'default':
      case 'far-field':
      default:
        return 'NC'; // Default to NC for compatibility
    }
  }

  async enableAudio(config: AudioConfig = {}): Promise<AudioTrack> {
    try {
      logger.info('Enabling audio', { config });

      if (this.isEnabled && this.currentTrack) {
        logger.debug('Audio already enabled, returning existing track');
        return this.convertToAudioTrack(this.currentTrack);
      }

      // Create microphone audio track with configuration
      const captureOptions: AudioCaptureOptions = {
        echoCancellation: config.enableAEC !== false, // Enable AEC by default
        noiseSuppression: config.enableANS !== false, // Enable ANS by default
        autoGainControl: config.enableAGC !== false, // Enable AGC by default
      };

      const audioTrack = await createLocalAudioTrack(captureOptions);

      // Apply AI denoiser if configured
      if (config.aiDenoiser?.enabled) {
        await this.applyAIDenoiser(audioTrack, config.aiDenoiser);
      }

      // Store the track but don't publish it yet
      this.currentTrack = audioTrack;
      this.isEnabled = true;

      const audioTrackInfo = this.convertToAudioTrack(audioTrack);

      logger.info('Audio enabled successfully', {
        trackId: audioTrackInfo.id,
        enabled: audioTrackInfo.enabled,
      });

      return audioTrackInfo;
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to enable audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to enable audio', {
        error: streamingError.message,
        config,
      });

      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async disableAudio(): Promise<void> {
    try {
      logger.info('Disabling audio');

      if (!this.isEnabled || !this.currentTrack) {
        logger.debug('Audio already disabled');
        return;
      }

      const trackId = this.currentTrack.sid || 'unknown';

      // Stop the track first
      this.currentTrack.stop();

      // Clear references
      this.currentTrack = null;
      this.isEnabled = false;

      logger.info('Audio disabled successfully', { trackId });

      this.callbacks.onAudioTrackUnpublished?.(trackId);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to disable audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to disable audio', {
        error: streamingError.message,
      });

      // Still mark as disabled even if there was an error
      this.isEnabled = false;
      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active audio track to set volume');
      }

      // Validate volume range (0-100)
      const normalizedVolume = Math.max(0, Math.min(100, volume));

      // LiveKit doesn't have direct volume control on the track level
      // Volume control would need to be implemented via Web Audio API
      // For now, we'll just log the intended volume
      logger.debug('Audio volume set (note: LiveKit requires Web Audio API for volume control)', {
        requestedVolume: volume,
        normalizedVolume,
      });
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to set audio volume: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to set audio volume', {
        error: streamingError.message,
        volume,
      });
      throw streamingError;
    }
  }

  async muteAudio(): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active audio track to mute');
      }

      await this.currentTrack.mute();

      logger.debug('Audio track muted');
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to mute audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to mute audio', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async unmuteAudio(): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active audio track to unmute');
      }

      await this.currentTrack.unmute();

      logger.debug('Audio track unmuted');
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to unmute audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to unmute audio', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async publishAudio(track: AudioTrack): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No audio track available to publish');
      }

      logger.info('Publishing audio track', {
        trackId: track.id,
      });

      // Check if track is already published
      const isPublished = this.room.localParticipant.audioTrackPublications.has(this.currentTrack.sid || '');

      if (isPublished) {
        logger.debug('Audio track already published, skipping');
        this.callbacks.onAudioTrackPublished?.(track);
        return;
      }

      await this.room.localParticipant.publishTrack(this.currentTrack);

      logger.info('Audio track published successfully', {
        trackId: track.id,
      });

      this.callbacks.onAudioTrackPublished?.(track);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to publish audio track: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to publish audio track', {
        error: streamingError.message,
      });

      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async unpublishAudio(): Promise<void> {
    try {
      if (!this.currentTrack) {
        logger.debug('No audio track to unpublish');
        return;
      }

      const trackId = this.currentTrack.sid || 'unknown';

      logger.info('Unpublishing audio track', { trackId });

      // Check if track is published before trying to unpublish
      const isPublished = this.room.localParticipant.audioTrackPublications.has(this.currentTrack.sid || '');

      if (isPublished && this.room.state === 'connected') {
        await this.room.localParticipant.unpublishTrack(this.currentTrack);
        logger.info('Audio track unpublished successfully');
      } else {
        logger.debug('Audio track not published or room not connected, skipping unpublish');
      }

      this.callbacks.onAudioTrackUnpublished?.(trackId);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to unpublish audio track: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to unpublish audio track', {
        error: streamingError.message,
      });

      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  // Unified AI Denoiser API implementation
  async enableAIDenoiser(config?: AIDenoiserConfig): Promise<void> {
    try {
      if (this.aiDenoiserState.isEnabled) {
        logger.debug('AI denoiser already enabled');
        return;
      }

      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No audio track available for AI denoiser');
      }

      const denoiserConfig = config || {
        enabled: true,
        mode: this.aiDenoiserState.mode,
        processingMode: 'frontend',
      };

      await this.applyAIDenoiser(this.currentTrack, denoiserConfig);

      this.aiDenoiserState = {
        isEnabled: true,
        mode: denoiserConfig.mode || 'default',
        isInitialized: true,
      };

      logger.info('LiveKit AI denoiser enabled', { mode: this.aiDenoiserState.mode });
    } catch (error) {
      logger.error('Failed to enable LiveKit AI denoiser', { error });
      throw error instanceof StreamingError
        ? error
        : new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Failed to enable AI denoiser');
    }
  }

  async updateAIDenoiserMode(mode: AIDenoiserMode): Promise<void> {
    try {
      if (!this.aiDenoiserState.isEnabled) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'AI denoiser not enabled');
      }

      // Update the processor mode if it exists
      if (this.krispProcessor) {
        const liveKitMode = this.convertToLiveKitMode(mode);
        // Note: LiveKit Krisp filter doesn't support mode switching at runtime
        // We would need to recreate the processor with the new mode
        logger.warn('LiveKit AI denoiser mode switching requires processor recreation', { mode, liveKitMode });
      }

      this.aiDenoiserState = {
        ...this.aiDenoiserState,
        mode: mode,
      };

      logger.info('LiveKit AI denoiser mode updated', { mode });
    } catch (error) {
      logger.error('Failed to update LiveKit AI denoiser mode', { error });
      throw error instanceof StreamingError
        ? error
        : new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Failed to update AI denoiser mode');
    }
  }

  async disableAIDenoiser(): Promise<void> {
    try {
      if (!this.aiDenoiserState.isEnabled) {
        logger.debug('AI denoiser already disabled');
        return;
      }

      if (this.krispProcessor && this.currentTrack) {
        await this.currentTrack.stopProcessor();
        this.krispProcessor = null;
      }

      this.aiDenoiserState = {
        isEnabled: false,
        mode: this.aiDenoiserState.mode,
        isInitialized: false,
      };

      logger.info('LiveKit AI denoiser disabled');
    } catch (error) {
      logger.error('Failed to disable LiveKit AI denoiser', { error });
      throw error instanceof StreamingError
        ? error
        : new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Failed to disable AI denoiser');
    }
  }

  // Legacy noise reduction methods for backward compatibility
  async enableNoiseReduction(): Promise<void> {
    return this.enableAIDenoiser();
  }

  async disableNoiseReduction(): Promise<void> {
    return this.disableAIDenoiser();
  }

  async dumpAudio(): Promise<void> {
    logger.info('Audio dump requested - LiveKit requires custom implementation');
    // Implementation would require custom audio recording and download logic
  }

  // Helper method to apply AI denoiser to audio track
  private async applyAIDenoiser(audioTrack: LocalAudioTrack, config: AIDenoiserConfig): Promise<void> {
    try {
      // Check if Krisp noise filter is supported
      if (typeof window === 'undefined') {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'LiveKit AI denoiser requires browser environment');
      }

      // Dynamic import of Krisp noise filter
      const { KrispNoiseFilter, isKrispNoiseFilterSupported } = await import('@livekit/krisp-noise-filter');

      if (!isKrispNoiseFilterSupported()) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Krisp noise filter is not supported on this browser');
      }

      // Create Krisp processor
      this.krispProcessor = KrispNoiseFilter();

      // Apply processor to track
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await audioTrack.setProcessor(this.krispProcessor as any);

      // Enable the processor
      await this.krispProcessor.setEnabled(true);

      logger.info('LiveKit AI denoiser applied to audio track', {
        mode: config.mode,
        processingMode: config.processingMode || 'frontend',
      });
    } catch (error) {
      logger.error('Failed to apply LiveKit AI denoiser', { error });
      throw error instanceof StreamingError
        ? error
        : new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Failed to apply AI denoiser');
    }
  }

  private convertToAudioTrack(liveKitTrack: LocalAudioTrack): AudioTrack {
    return {
      id: liveKitTrack.sid || `audio-${Date.now()}`,
      kind: 'audio',
      enabled: !liveKitTrack.isMuted,
      muted: liveKitTrack.isMuted,
      volume: 100, // LiveKit doesn't expose volume directly
    };
  }

  // Getters
  get audioEnabled(): boolean {
    return this.isEnabled;
  }

  get audioTrack(): AudioTrack | null {
    return this.currentTrack ? this.convertToAudioTrack(this.currentTrack) : null;
  }

  get nativeTrack(): LocalAudioTrack | null {
    return this.currentTrack;
  }

  // Check if there's an active audio track
  hasActiveTrack(): boolean {
    return this.currentTrack !== null && this.isEnabled;
  }

  // AI Denoiser getter methods
  isAIDenoiserEnabled(): boolean {
    return this.aiDenoiserState.isEnabled;
  }

  getAIDenoiserMode(): AIDenoiserMode {
    return this.aiDenoiserState.mode;
  }

  getAIDenoiserState(): AIDenoiserState {
    return { ...this.aiDenoiserState };
  }

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    try {
      // Disable AI denoiser if enabled
      if (this.aiDenoiserState.isEnabled) {
        await this.disableAIDenoiser();
      }

      // Disable audio track if enabled
      if (this.currentTrack) {
        await this.disableAudio();
      }

      // Clear all references
      this.callbacks = {};
      this.aiDenoiserState = {
        isEnabled: false,
        mode: 'default',
        isInitialized: false,
      };
    } catch (error) {
      logger.error('Error during audio controller cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
