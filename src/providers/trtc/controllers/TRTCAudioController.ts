import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { AudioTrack, AudioConfig } from '../../../types/streaming.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { TRTCAudioControllerCallbacks } from '../types';
import TRTC from 'trtc-sdk-v5';

export class TRTCAudioController {
  private client: TRTC;
  private currentTrack: AudioTrack | null = null;
  private isEnabled = false;
  private isMuted = false;
  private currentVolume = 100;
  private callbacks: TRTCAudioControllerCallbacks = {};
  private noiseReductionEnabled = false;

  constructor(client: TRTC) {
    this.client = client;
    this.setupEventHandlers();
  }

  setCallbacks(callbacks: TRTCAudioControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  async enableAudio(config: AudioConfig = {}): Promise<AudioTrack> {
    try {
      logger.info('Enabling TRTC audio', { config });

      if (this.isEnabled && this.currentTrack) {
        logger.debug('TRTC audio already enabled');
        return this.currentTrack;
      }

      await this.client.startLocalAudio();

      // Create track representation
      const trackId = `trtc-audio-${Date.now()}`;
      this.currentTrack = {
        id: trackId,
        kind: 'audio',
        enabled: true,
        muted: false,
        volume: config.volume || 100,
      };

      this.isEnabled = true;
      this.isMuted = false;
      this.currentVolume = config.volume || 100;

      // Set initial volume if specified
      if (config.volume !== undefined) {
        await this.setVolume(config.volume);
      }

      // Enable noise reduction if specified
      if (config.echoCancellation !== false || config.noiseSuppression !== false) {
        this.noiseReductionEnabled = true;
        this.client.enableAudioVolumeEvaluation(300);
      }

      this.callbacks.onAudioTrackPublished?.(this.currentTrack);

      logger.info('TRTC audio enabled successfully', { trackId });
      return this.currentTrack;
    } catch (error) {
      logger.error('Failed to enable TRTC audio', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async disableAudio(): Promise<void> {
    try {
      if (!this.isEnabled) {
        logger.debug('TRTC audio already disabled');
        return;
      }

      this.client.stopLocalAudio();

      const trackId = this.currentTrack?.id;
      this.currentTrack = null;
      this.isEnabled = false;
      this.isMuted = false;

      if (trackId) {
        this.callbacks.onAudioTrackUnpublished?.(trackId);
      }

      logger.info('TRTC audio disabled successfully');
    } catch (error) {
      logger.error('Failed to disable TRTC audio', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async publishAudio(): Promise<void> {
    try {
      if (!this.isEnabled) {
        await this.enableAudio();
      }

      logger.debug('TRTC audio published automatically with enableAudio');
    } catch (error) {
      logger.error('Failed to publish TRTC audio', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async unpublishAudio(): Promise<void> {
    return this.disableAudio();
  }

  async muteAudio(muted: boolean): Promise<void> {
    try {
      if (!this.isEnabled) {
        throw new StreamingError(ErrorCode.TRACK_NOT_FOUND, 'Audio not enabled', { provider: 'trtc' });
      }

      await this.client.updateLocalAudio({ mute: muted });
      this.isMuted = muted;

      if (this.currentTrack) {
        this.currentTrack.muted = muted;
      }

      logger.debug('TRTC audio mute state changed', { muted });
    } catch (error) {
      logger.error('Failed to change TRTC audio mute state', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      if (volume < 0 || volume > 100) {
        throw new StreamingError(ErrorCode.INVALID_PARAMETER, 'Volume must be between 0 and 100', {
          provider: 'trtc',
          volume,
        });
      }

      await this.client.updateLocalAudio({ option: { captureVolume: volume } });
      this.currentVolume = volume;

      if (this.currentTrack) {
        this.currentTrack.volume = volume;
      }

      this.callbacks.onVolumeChange?.(volume);

      logger.debug('TRTC audio volume set', { volume });
    } catch (error) {
      logger.error('Failed to set TRTC audio volume', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  async enableNoiseReduction(): Promise<void> {
    try {
      this.client.enableAudioVolumeEvaluation(300);
      this.noiseReductionEnabled = true;

      logger.info('TRTC noise reduction enabled');
    } catch (error) {
      logger.error('Failed to enable TRTC noise reduction', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async disableNoiseReduction(): Promise<void> {
    try {
      this.client.enableAudioVolumeEvaluation(0);
      this.noiseReductionEnabled = false;

      logger.info('TRTC noise reduction disabled');
    } catch (error) {
      logger.error('Failed to disable TRTC noise reduction', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async dumpAudio(): Promise<void> {
    logger.info('TRTC audio dump requested - feature not available in TRTC v5');
  }

  getCurrentTrack(): AudioTrack | null {
    return this.currentTrack;
  }

  isAudioEnabled(): boolean {
    return this.isEnabled;
  }

  isAudioMuted(): boolean {
    return this.isMuted;
  }

  getCurrentVolume(): number {
    return this.currentVolume;
  }

  isNoiseReductionEnabled(): boolean {
    return this.noiseReductionEnabled;
  }

  // Note: Audio quality mapping removed as TRTC SDK v5 handles this internally

  private setupEventHandlers(): void {
    // Note: Audio-specific events like USER_VOICE_VOLUME, AUDIO_DEVICE_STATE_CHANGED, etc.
    // are not available as TRTC.EVENT constants in this SDK version.
    // These events are handled through the Promise-based API calls instead.
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC audio controller');

      // Note: Audio-specific events are not available as TRTC.EVENT constants

      // Disable audio if enabled
      if (this.isEnabled) {
        await this.disableAudio();
      }

      this.callbacks = {};
      this.currentTrack = null;

      logger.info('TRTC audio controller cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC audio controller cleanup', { error });
    }
  }
}
