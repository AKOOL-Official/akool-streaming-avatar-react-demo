import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { AudioTrack, AudioConfig } from '../../../types/streaming.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { TRTCAudioControllerCallbacks } from '../types';

// TRTC SDK v5 client interface (simplified)
interface TRTCClient {
  startLocalAudio(quality?: number): Promise<void>;
  stopLocalAudio(): void;
  muteLocalAudio(mute: boolean): void;
  setAudioCaptureVolume(volume: number): void;
  enableAudioVolumeEvaluation(intervalMs: number): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
}

export class TRTCAudioController {
  private client: TRTCClient;
  private currentTrack: AudioTrack | null = null;
  private isEnabled = false;
  private isMuted = false;
  private currentVolume = 100;
  private callbacks: TRTCAudioControllerCallbacks = {};
  private noiseReductionEnabled = false;

  constructor(client: TRTCClient) {
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

      // TRTC v5 audio quality mapping
      const audioQuality = this.mapAudioQuality(config.quality);

      await this.client.startLocalAudio(audioQuality);

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

      this.client.muteLocalAudio(muted);
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

      this.client.setAudioCaptureVolume(volume);
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

  private mapAudioQuality(quality?: string): number {
    // TRTC audio quality constants
    const QUALITY_SPEECH = 1; // 16k sample rate, mono
    const QUALITY_DEFAULT = 2; // 48k sample rate, mono
    const QUALITY_MUSIC = 3; // 48k sample rate, stereo

    switch (quality) {
      case 'speech':
        return QUALITY_SPEECH;
      case 'music':
        return QUALITY_MUSIC;
      default:
        return QUALITY_DEFAULT;
    }
  }

  private setupEventHandlers(): void {
    this.client.on('onUserVoiceVolume', (...args: unknown[]) => {
      const userVolumes = args[0] as Array<{ userId: string; volume: number }>;
      // Find local user volume
      const localVolume = userVolumes.find((user) => user.userId === '');
      if (localVolume) {
        this.callbacks.onVolumeChange?.(localVolume.volume);
      }
    });

    this.client.on('onAudioDeviceStateChanged', (...args: unknown[]) => {
      const [deviceId, deviceType, deviceState] = args as [string, number, number];
      logger.info('TRTC audio device state changed', { deviceId, deviceType, deviceState });
    });

    this.client.on('onTestMicVolume', (...args: unknown[]) => {
      const volume = args[0] as number;
      this.callbacks.onVolumeChange?.(volume);
    });
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC audio controller');

      // Remove event listeners
      this.client.off('onUserVoiceVolume');
      this.client.off('onAudioDeviceStateChanged');
      this.client.off('onTestMicVolume');

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
