import { Room, LocalAudioTrack, createLocalAudioTrack, AudioCaptureOptions } from 'livekit-client';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { AudioTrack, AudioConfig } from '../../../types/streaming.types';
import { LiveKitAudioControllerCallbacks } from '../types';

export class LiveKitAudioController {
  private room: Room;
  private currentTrack: LocalAudioTrack | null = null;
  private isEnabled = false;
  private callbacks: LiveKitAudioControllerCallbacks = {};

  constructor(room: Room) {
    this.room = room;
  }

  setCallbacks(callbacks: LiveKitAudioControllerCallbacks): void {
    this.callbacks = callbacks;
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

      // Publish the audio track
      await this.room.localParticipant.publishTrack(audioTrack);

      this.currentTrack = audioTrack;
      this.isEnabled = true;

      const audioTrackInfo = this.convertToAudioTrack(audioTrack);

      logger.info('Audio enabled successfully', {
        trackId: audioTrackInfo.id,
        enabled: audioTrackInfo.enabled,
      });

      this.callbacks.onAudioTrackPublished?.(audioTrackInfo);
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

      // Unpublish the track if room is connected
      if (this.room.state === 'connected') {
        await this.room.localParticipant.unpublishTrack(this.currentTrack);
      } else {
        logger.debug('Room not connected, skipping unpublish for audio track');
      }

      // Stop the track
      this.currentTrack.stop();

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

      // Only unpublish if room is connected
      if (this.room.state === 'connected') {
        await this.room.localParticipant.unpublishTrack(this.currentTrack);
      } else {
        logger.debug('Room not connected, skipping unpublish for audio track');
      }

      logger.info('Audio track unpublished successfully');

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

  // LiveKit doesn't have built-in noise reduction like Agora
  // These methods are placeholder implementations for interface compatibility
  async enableNoiseReduction(): Promise<void> {
    logger.info('Noise reduction requested - LiveKit requires custom Web Audio API implementation');
    // Implementation would require Web Audio API integration
  }

  async disableNoiseReduction(): Promise<void> {
    logger.info('Disable noise reduction requested - LiveKit requires custom Web Audio API implementation');
    // Implementation would require Web Audio API integration
  }

  async dumpAudio(): Promise<void> {
    logger.info('Audio dump requested - LiveKit requires custom implementation');
    // Implementation would require custom audio recording and download logic
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

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    try {
      // Disable audio track if enabled
      if (this.currentTrack) {
        await this.disableAudio();
      }

      // Clear all references
      this.callbacks = {};
    } catch (error) {
      logger.error('Error during audio controller cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
