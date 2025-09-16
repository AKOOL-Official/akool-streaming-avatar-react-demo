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
import { ErrorMapper } from '../../../errors/ErrorMapper';
import TRTC from 'trtc-sdk-v5';

export class TRTCAudioController {
  private client: TRTC;
  private currentTrack: AudioTrack | null = null;
  private isEnabled = false;
  private isMuted = false;
  private currentVolume = 100;
  private callbacks: AudioControllerCallbacks = {};
  private noiseReductionEnabled = false;
  private noiseReductionMode: 'basic' | 'ai' = 'basic';
  private aiDenoiserState: AIDenoiserState = {
    isEnabled: false,
    mode: 'default',
    isInitialized: false,
  };
  private aiDenoiserAssetsPath?: string;

  constructor(client: TRTC) {
    this.client = client;
    this.setupEventHandlers();
  }

  // Helper method to convert unified AI denoiser mode to TRTC mode
  private convertToTRTCMode(mode: AIDenoiserMode): 0 | 1 {
    switch (mode) {
      case 'far-field':
        return 1;
      case 'default':
      case 'nsng':
      case 'stationary':
      default:
        return 0;
    }
  }

  // Helper method to convert TRTC mode to unified AI denoiser mode
  // private convertFromTRTCMode(mode: 0 | 1): AIDenoiserMode {
  //   return mode === 1 ? 'far-field' : 'default';
  // }

  setCallbacks(callbacks: AudioControllerCallbacks): void {
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

      // Configure noise reduction based on config
      if (config.echoCancellation !== false || config.noiseSuppression !== false || config.aiDenoiser?.enabled) {
        this.noiseReductionEnabled = true;

        if (config.aiDenoiser?.enabled) {
          // Use AI denoiser
          this.noiseReductionMode = 'ai';
          this.aiDenoiserState = {
            isEnabled: false, // Will be enabled when credentials are available
            mode: config.aiDenoiser.mode || 'default',
            isInitialized: false,
          };
          this.aiDenoiserAssetsPath = config.aiDenoiser.assetsPath;
          // AI denoiser will be enabled when credentials are available
        } else {
          // Use basic noise reduction
          this.noiseReductionMode = 'basic';
          this.client.enableAudioVolumeEvaluation(300);
        }
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
      if (this.noiseReductionMode === 'ai') {
        // AI denoiser is already configured, just enable it
        this.noiseReductionEnabled = true;
        logger.info('TRTC AI noise reduction enabled');
      } else {
        // Use basic noise reduction
        this.client.enableAudioVolumeEvaluation(300);
        this.noiseReductionEnabled = true;
        this.noiseReductionMode = 'basic';
        logger.info('TRTC basic noise reduction enabled');
      }
    } catch (error) {
      logger.error('Failed to enable TRTC noise reduction', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async disableNoiseReduction(): Promise<void> {
    try {
      if (this.noiseReductionMode === 'ai') {
        // Disable AI denoiser
        await this.disableAIDenoiser();
      } else {
        // Disable basic noise reduction
        this.client.enableAudioVolumeEvaluation(0);
      }

      this.noiseReductionEnabled = false;
      logger.info('TRTC noise reduction disabled');
    } catch (error) {
      logger.error('Failed to disable TRTC noise reduction', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async enableAIDenoiser(config?: AIDenoiserConfig): Promise<void> {
    try {
      if (this.aiDenoiserState.isEnabled) {
        logger.debug('AI denoiser already enabled');
        return;
      }

      // Use provided config or current state
      const denoiserConfig = config || {
        enabled: true,
        mode: this.aiDenoiserState.mode,
        assetsPath: this.aiDenoiserAssetsPath,
      };

      // Check if we have the required credentials for AI denoiser
      if (
        !denoiserConfig.credentials?.sdkAppId ||
        !denoiserConfig.credentials?.userId ||
        !denoiserConfig.credentials?.userSig
      ) {
        throw new StreamingError(ErrorCode.INVALID_PARAMETER, 'AI denoiser requires sdkAppId, userId, and userSig', {
          provider: 'trtc',
        });
      }

      const trtcMode = this.convertToTRTCMode(denoiserConfig.mode || 'default');
      const denoiserOptions = {
        sdkAppId: denoiserConfig.credentials.sdkAppId,
        userId: denoiserConfig.credentials.userId,
        userSig: denoiserConfig.credentials.userSig,
        mode: trtcMode,
        ...(denoiserConfig.assetsPath && { assetsPath: denoiserConfig.assetsPath }),
      };

      await this.client.startPlugin('AIDenoiser', denoiserOptions);

      this.aiDenoiserState = {
        isEnabled: true,
        mode: denoiserConfig.mode || 'default',
        isInitialized: true,
      };
      this.noiseReductionEnabled = true;
      this.noiseReductionMode = 'ai';

      logger.info('TRTC AI denoiser enabled', { mode: this.aiDenoiserState.mode });
    } catch (error) {
      logger.error('Failed to enable TRTC AI denoiser', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async updateAIDenoiserMode(mode: AIDenoiserMode): Promise<void> {
    try {
      if (!this.aiDenoiserState.isEnabled) {
        throw new StreamingError(ErrorCode.INVALID_PARAMETER, 'AI denoiser not enabled', { provider: 'trtc' });
      }

      const trtcMode = this.convertToTRTCMode(mode);

      await this.client.updatePlugin('AIDenoiser', { mode: trtcMode });

      this.aiDenoiserState = {
        ...this.aiDenoiserState,
        mode: mode,
      };

      logger.info('TRTC AI denoiser mode updated', { mode: mode, trtcMode: trtcMode });
    } catch (error) {
      logger.error('Failed to update TRTC AI denoiser mode', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async disableAIDenoiser(): Promise<void> {
    try {
      if (!this.aiDenoiserState.isEnabled) {
        logger.debug('AI denoiser already disabled');
        return;
      }

      await this.client.stopPlugin('AIDenoiser');

      this.aiDenoiserState = {
        isEnabled: false,
        mode: this.aiDenoiserState.mode,
        isInitialized: false,
      };
      this.noiseReductionEnabled = false;
      this.noiseReductionMode = 'basic';

      logger.info('TRTC AI denoiser disabled');
    } catch (error) {
      logger.error('Failed to disable TRTC AI denoiser', { error });
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

  getNoiseReductionMode(): 'basic' | 'ai' {
    return this.noiseReductionMode;
  }

  isAIDenoiserEnabled(): boolean {
    return this.aiDenoiserState.isEnabled;
  }

  getAIDenoiserMode(): AIDenoiserMode {
    return this.aiDenoiserState.mode;
  }

  getAIDenoiserState(): AIDenoiserState {
    return { ...this.aiDenoiserState };
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

      // Disable noise reduction if enabled (handles both basic and AI modes)
      if (this.noiseReductionEnabled) {
        await this.disableNoiseReduction();
      }

      // Disable audio if enabled
      if (this.isEnabled) {
        await this.disableAudio();
      }

      this.callbacks = {};
      this.currentTrack = null;
      this.noiseReductionEnabled = false;
      this.noiseReductionMode = 'basic';
      this.aiDenoiserState = {
        isEnabled: false,
        mode: 'default',
        isInitialized: false,
      };

      logger.info('TRTC audio controller cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC audio controller cleanup', { error });
    }
  }
}
