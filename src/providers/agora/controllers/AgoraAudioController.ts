import { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { AIDenoiserExtension, IAIDenoiserProcessor, AIDenoiserProcessorMode } from 'agora-extension-ai-denoiser';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { AudioTrack } from '../../../types/streaming.types';

// Register the AI denoiser extension globally when the module loads
const aiDenoiser = new AIDenoiserExtension({
  assetsPath: './external', // Path to Wasm files - will be served from public directory
});

AgoraRTC.registerExtensions([aiDenoiser]);

export interface AudioControllerCallbacks {
  onAudioTrackPublished?: (track: AudioTrack) => void;
  onAudioTrackUnpublished?: (trackId: string) => void;
  onAudioError?: (error: StreamingError) => void;
}

// AI Denoiser Processor interface (using the actual type from the package)

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
  private aiDenoiserProcessor: IAIDenoiserProcessor | null = null;
  private isNoiseReductionEnabled = false;
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
        ANS: false, // Disable ANS by default (we use AI denoiser)
        AGC: config.enableAGC !== false, // Enable AGC by default
      });

      // Apply noise reduction to the audio track
      await this.applyNoiseReduction(audioTrack);

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

  async publishAudio(): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No audio track available to publish');
      }

      logger.info('Publishing audio track', {
        trackId: this.currentTrack.getTrackId(),
      });

      await this.client.publish(this.currentTrack);

      logger.info('Audio track published successfully', {
        trackId: this.currentTrack.getTrackId(),
      });

      const audioTrackInfo = this.convertToAudioTrack(this.currentTrack);
      this.callbacks.onAudioTrackPublished?.(audioTrackInfo);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
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

      logger.info('Unpublishing audio track', {
        trackId: this.currentTrack.getTrackId(),
      });

      // Only unpublish if client is connected to channel
      if (this.client.connectionState === 'CONNECTED') {
        await this.client.unpublish(this.currentTrack);
      } else {
        logger.debug('Client not connected, skipping unpublish for audio track');
      }

      logger.info('Audio track unpublished successfully');

      this.callbacks.onAudioTrackUnpublished?.(this.currentTrack.getTrackId());
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to unpublish audio track', {
        error: streamingError.message,
      });

      this.callbacks.onAudioError?.(streamingError);
      throw streamingError;
    }
  }

  // Apply noise reduction to the audio track using AI denoiser
  async applyNoiseReduction(audioTrack: IMicrophoneAudioTrack): Promise<boolean> {
    try {
      if (!audioTrack) {
        logger.warn('No audio track provided for noise reduction');
        return false;
      }

      if (this.aiDenoiserProcessor) {
        logger.debug('Noise reduction already applied to this track');
        return true;
      }

      logger.debug('Applying AI noise reduction to audio track', {
        trackId: audioTrack.getTrackId(),
      });

      // Create the AI denoiser processor
      this.aiDenoiserProcessor = aiDenoiser.createProcessor();

      // Set up event listeners for processor
      this.aiDenoiserProcessor.onoverload = (elapsedTime: number) => {
        logger.warn(`AI Denoiser overload detected: ${elapsedTime}ms processing time`);
        // Optionally switch to stationary noise reduction mode
        this.aiDenoiserProcessor?.setMode(AIDenoiserProcessorMode.STATIONARY_NS).catch((error) => {
          logger.error('Failed to switch to stationary mode', { error });
        });
      };

      // Set denoiser mode
      await this.aiDenoiserProcessor.setMode(AIDenoiserProcessorMode.NSNG);

      // Pipe the audio track through the processor
      await audioTrack.pipe(this.aiDenoiserProcessor).pipe(audioTrack.processorDestination);

      // Enable or disable based on current state
      if (this.isNoiseReductionEnabled) {
        await this.aiDenoiserProcessor.enable();
      } else {
        await this.aiDenoiserProcessor.disable();
      }

      logger.info('AI noise reduction applied to audio track', {
        trackId: audioTrack.getTrackId(),
      });

      return true;
    } catch (error) {
      logger.error('Failed to apply noise reduction to audio track', { error });
      return false;
    }
  }

  // Enable noise reduction
  async enableNoiseReduction(): Promise<void> {
    try {
      if (this.isNoiseReductionEnabled) {
        logger.debug('Noise reduction already enabled');
        return;
      }

      if (!this.aiDenoiserProcessor) {
        logger.warn('Noise reduction processor not initialized - please enable microphone first');
        return;
      }

      logger.debug('Enabling noise reduction');

      await this.aiDenoiserProcessor.enable();
      this.isNoiseReductionEnabled = true;

      logger.info('Noise reduction enabled successfully');
    } catch (error) {
      logger.error('Failed to enable noise reduction', { error });
      throw error;
    }
  }

  // Disable noise reduction
  async disableNoiseReduction(): Promise<void> {
    try {
      if (!this.isNoiseReductionEnabled) {
        logger.debug('Noise reduction already disabled');
        return;
      }

      if (!this.aiDenoiserProcessor) {
        logger.debug('No noise reduction processor to disable');
        return;
      }

      logger.debug('Disabling noise reduction');

      await this.aiDenoiserProcessor.disable();
      this.isNoiseReductionEnabled = false;

      logger.info('Noise reduction disabled successfully');
    } catch (error) {
      logger.error('Failed to disable noise reduction', { error });
      throw error;
    }
  }

  // Dump audio data for analysis
  async dumpAudio(): Promise<void> {
    try {
      if (!this.aiDenoiserProcessor) {
        logger.warn('Noise reduction processor not initialized - please enable microphone first');
        return;
      }

      logger.debug('Starting audio dump');

      // Set up dump event listeners if not already set
      this.aiDenoiserProcessor.ondump = (blob: Blob, name: string) => {
        logger.info(`Audio dump received: ${name}`);
        // Create download link for the audio file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      this.aiDenoiserProcessor.ondumpend = () => {
        logger.info('Audio dump completed');
      };

      // Start the dump
      this.aiDenoiserProcessor.dump();
      logger.info('Audio dump started - will download 9 audio files automatically');
    } catch (error) {
      logger.error('Failed to start audio dump', { error });
      throw error;
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

  // Get noise reduction status
  get noiseReductionEnabled(): boolean {
    return this.isNoiseReductionEnabled;
  }

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    try {
      // Disable noise reduction if enabled
      if (this.isNoiseReductionEnabled) {
        await this.disableNoiseReduction();
      }

      // Disable and cleanup audio track
      if (this.currentTrack) {
        await this.disableAudio();
      }

      // Clean up AI denoiser processor
      if (this.aiDenoiserProcessor) {
        try {
          await this.aiDenoiserProcessor.disable();
        } catch (error) {
          logger.warn('Failed to disable AI denoiser processor', { error });
        }
        this.aiDenoiserProcessor = null;
      }

      // Clear all references
      this.isNoiseReductionEnabled = false;
      this.callbacks = {};
    } catch (error) {
      logger.error('Error during audio controller cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
