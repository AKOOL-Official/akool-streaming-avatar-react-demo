import { AudioStrategy } from '../../../types/provider.interfaces';
import { AudioTrack } from '../../../types/streaming.types';
import { AgoraAudioController } from '../controllers/AgoraAudioController';
import { logger } from '../../../core/Logger';
import { IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

export class AgoraAudioStrategy implements AudioStrategy {
  private audioController: AgoraAudioController;

  constructor(audioController: AgoraAudioController) {
    this.audioController = audioController;
  }

  async createTrack(constraints?: MediaTrackConstraints): Promise<AudioTrack> {
    try {
      logger.debug('Creating audio track with constraints', { constraints });

      const config = this.mapConstraintsToConfig(constraints);
      const audioTrack = await this.audioController.enableAudio(config);

      logger.info('Audio track created successfully', {
        trackId: audioTrack.id,
        enabled: audioTrack.enabled,
      });

      return audioTrack;
    } catch (error) {
      logger.error('Failed to create audio track', {
        error: error instanceof Error ? error.message : String(error),
        constraints,
      });
      throw error;
    }
  }

  async publishTrack(track: AudioTrack): Promise<void> {
    try {
      logger.debug('Publishing audio track', { trackId: track.id });

      if (!this.audioController.hasActiveTrack()) {
        // Enable audio if not already active
        await this.audioController.enableAudio();
      }

      // The audio controller automatically publishes when enabled
      logger.info('Audio track published successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to publish audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async unpublishTrack(track: AudioTrack): Promise<void> {
    try {
      logger.debug('Unpublishing audio track', { trackId: track.id });

      await this.audioController.disableAudio();

      logger.info('Audio track unpublished successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to unpublish audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async setVolume(track: AudioTrack, volume: number): Promise<void> {
    try {
      logger.debug('Setting audio volume', { trackId: track.id, volume });

      await this.audioController.setVolume(volume);

      logger.info('Audio volume set successfully', { trackId: track.id, volume });
    } catch (error) {
      logger.error('Failed to set audio volume', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
        volume,
      });
      throw error;
    }
  }

  async enableTrack(track: AudioTrack): Promise<void> {
    try {
      logger.debug('Enabling audio track', { trackId: track.id });

      await this.audioController.unmuteAudio();

      logger.info('Audio track enabled successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to enable audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async disableTrack(track: AudioTrack): Promise<void> {
    try {
      logger.debug('Disabling audio track', { trackId: track.id });

      await this.audioController.muteAudio();

      logger.info('Audio track disabled successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to disable audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  // Helper method to map MediaTrackConstraints to Agora-specific config
  private mapConstraintsToConfig(constraints?: MediaTrackConstraints): Record<string, unknown> {
    if (!constraints) {
      return {
        encoderConfig: 'speech_low_quality',
        enableAEC: true,
        enableANS: false,
        enableAGC: true,
      };
    }

    // Extract audio-specific constraints
    const audioConfig: Record<string, unknown> = {
      enableAEC: true,
      enableAGC: true,
      enableANS: false, // Disabled by default to use AI denoiser
    };

    // Map standard constraints to Agora config
    if (constraints.sampleRate) {
      // Agora doesn't directly support sampleRate in createMicrophoneAudioTrack
      // but we can log it for debugging
      logger.debug('Sample rate constraint specified', { sampleRate: constraints.sampleRate });
    }

    if (constraints.channelCount) {
      logger.debug('Channel count constraint specified', { channelCount: constraints.channelCount });
    }

    if (constraints.echoCancellation !== undefined) {
      audioConfig.enableAEC = !!constraints.echoCancellation;
    }

    if (constraints.noiseSuppression !== undefined) {
      audioConfig.enableANS = !!constraints.noiseSuppression;
    }

    if (constraints.autoGainControl !== undefined) {
      audioConfig.enableAGC = !!constraints.autoGainControl;
    }

    // Set encoder config based on quality preferences
    if (constraints.sampleRate && typeof constraints.sampleRate === 'number') {
      if (constraints.sampleRate >= 48000) {
        audioConfig.encoderConfig = 'music_standard';
      } else if (constraints.sampleRate >= 32000) {
        audioConfig.encoderConfig = 'speech_standard';
      } else {
        audioConfig.encoderConfig = 'speech_low_quality';
      }
    }

    return audioConfig;
  }

  // Get current audio level for visualization
  getVolumeLevel(): number {
    return this.audioController.getVolumeLevel();
  }

  // Check if audio is currently enabled
  isEnabled(): boolean {
    return this.audioController.audioEnabled;
  }

  // Get the current audio track
  getCurrentTrack(): AudioTrack | null {
    return this.audioController.audioTrack;
  }

  // Apply noise reduction to the audio track
  async applyNoiseReduction(audioTrack: IMicrophoneAudioTrack): Promise<void> {
    try {
      await this.audioController.applyNoiseReduction(audioTrack);
      logger.info('Noise reduction applied to audio track');
    } catch (error) {
      logger.error('Failed to apply noise reduction', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
