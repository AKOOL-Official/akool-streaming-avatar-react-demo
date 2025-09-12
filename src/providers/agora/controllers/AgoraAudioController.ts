import { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { AudioTrack } from '../../../types/streaming.types';

export interface AudioControllerCallbacks {
  onAudioTrackPublished?: (track: AudioTrack) => void;
  onAudioTrackUnpublished?: (trackId: string) => void;
  onAudioError?: (error: StreamingError) => void;
}

export interface AudioConfig {
  encoderConfig?: string;
  enableAEC?: boolean;
  enableANS?: boolean;
  enableAGC?: boolean;
}

export class AgoraAudioController {
  private client: IAgoraRTCClient;
  private currentTrack: IMicrophoneAudioTrack | null = null;
  private isEnabled = false;
  private callbacks: AudioControllerCallbacks = {};

  constructor(client: IAgoraRTCClient) {
    this.client = client;
  }

  setCallbacks(callbacks: AudioControllerCallbacks): void {
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
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: (config.encoderConfig as unknown) || 'speech_low_quality',
        AEC: config.enableAEC !== false, // Enable AEC by default
        ANS: config.enableANS || false, // Disable ANS by default (we use AI denoiser)
        AGC: config.enableAGC !== false, // Enable AGC by default
      });

      // Publish the audio track
      await this.client.publish(audioTrack);

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
      const streamingError = ErrorMapper.mapAgoraError(error);
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

      const trackId = this.currentTrack.getTrackId();

      // Only unpublish if client is connected to channel
      if (this.client.connectionState === 'CONNECTED') {
        await this.client.unpublish(this.currentTrack);
      } else {
        logger.debug('Client not connected, skipping unpublish for audio track');
      }

      // Stop and close the track
      this.currentTrack.stop();
      this.currentTrack.close();

      this.currentTrack = null;
      this.isEnabled = false;

      logger.info('Audio disabled successfully', { trackId });

      this.callbacks.onAudioTrackUnpublished?.(trackId);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
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

      // Agora expects volume in range 0-100
      this.currentTrack.setVolume(normalizedVolume);

      logger.debug('Audio volume set', {
        requestedVolume: volume,
        normalizedVolume,
      });
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
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

      await this.currentTrack.setEnabled(false);

      logger.debug('Audio track muted');
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
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

      await this.currentTrack.setEnabled(true);

      logger.debug('Audio track unmuted');
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to unmute audio', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  // Apply noise reduction to the audio track
  async applyNoiseReduction(processor?: unknown): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active audio track for noise reduction');
      }

      // Note: This is a placeholder for noise reduction integration
      // The actual implementation would depend on the specific noise reduction
      // processor being used (e.g., Agora's AI Denoiser)
      logger.debug('Applying noise reduction to audio track', {
        trackId: this.currentTrack.getTrackId(),
        hasProcessor: !!processor,
      });

      // TODO: Implement actual noise reduction integration
      // This would typically involve:
      // 1. Creating the noise reduction processor
      // 2. Applying it to the audio track
      // await this.currentTrack.pipe(processor);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to apply noise reduction', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  private convertToAudioTrack(agoraTrack: IMicrophoneAudioTrack): AudioTrack {
    return {
      id: agoraTrack.getTrackId(),
      kind: 'audio',
      enabled: agoraTrack.enabled,
      muted: agoraTrack.muted,
      volume: agoraTrack.getVolumeLevel() || 0,
    };
  }

  // Getters
  get audioEnabled(): boolean {
    return this.isEnabled;
  }

  get audioTrack(): AudioTrack | null {
    return this.currentTrack ? this.convertToAudioTrack(this.currentTrack) : null;
  }

  get nativeTrack(): IMicrophoneAudioTrack | null {
    return this.currentTrack;
  }

  // Check if there's an active audio track
  hasActiveTrack(): boolean {
    return this.currentTrack !== null && this.isEnabled;
  }

  // Get current audio level (for visualization)
  getVolumeLevel(): number {
    return this.currentTrack?.getVolumeLevel() || 0;
  }

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    try {
      if (this.currentTrack) {
        await this.disableAudio();
      }
      this.callbacks = {};
    } catch (error) {
      logger.error('Error during audio controller cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
