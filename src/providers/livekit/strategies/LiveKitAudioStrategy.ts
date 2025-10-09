import { AudioStrategy } from '../../../types/provider.interfaces';
import { AudioTrack } from '../../../types/streaming.types';
import { LiveKitAudioController } from '../controllers/LiveKitAudioController';
import { logger } from '../../../core/Logger';

export class LiveKitAudioStrategy implements AudioStrategy {
  private audioController: LiveKitAudioController;

  constructor(audioController: LiveKitAudioController) {
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

      await this.audioController.unpublishAudio();

      logger.info('Audio track unpublished successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to unpublish audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
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

  async setVolume(track: AudioTrack, volume: number): Promise<void> {
    try {
      logger.debug('Setting audio track volume', { trackId: track.id, volume });

      await this.audioController.setVolume(volume);

      logger.info('Audio track volume set successfully', { trackId: track.id, volume });
    } catch (error) {
      logger.error('Failed to set audio track volume', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
        volume,
      });
      throw error;
    }
  }

  // Additional methods for advanced audio control (not part of AudioStrategy interface)
  async getVolume(track: AudioTrack): Promise<number> {
    try {
      logger.debug('Getting audio track volume', { trackId: track.id });

      // Note: getVolumeLevel method needs to be added to LiveKitAudioController
      // For now, return a default value
      const volume = 1.0; // this.audioController.getVolumeLevel();

      logger.debug('Audio track volume retrieved', { trackId: track.id, volume });
      return volume;
    } catch (error) {
      logger.error('Failed to get audio track volume', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async enableNoiseReduction(track: AudioTrack): Promise<void> {
    try {
      logger.debug('Enabling noise reduction for audio track', { trackId: track.id });

      await this.audioController.enableNoiseReduction();

      logger.info('Noise reduction enabled for audio track', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to enable noise reduction for audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async disableNoiseReduction(track: AudioTrack): Promise<void> {
    try {
      logger.debug('Disabling noise reduction for audio track', { trackId: track.id });

      await this.audioController.disableNoiseReduction();

      logger.info('Noise reduction disabled for audio track', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to disable noise reduction for audio track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  private mapConstraintsToConfig(constraints?: MediaTrackConstraints): Record<string, unknown> {
    if (!constraints) {
      return {};
    }

    // Map MediaTrackConstraints to LiveKit audio config
    const config: Record<string, unknown> = {};

    if (constraints.echoCancellation !== undefined) {
      config.enableAEC = constraints.echoCancellation;
    }

    if (constraints.noiseSuppression !== undefined) {
      config.enableANS = constraints.noiseSuppression;
    }

    if (constraints.autoGainControl !== undefined) {
      config.enableAGC = constraints.autoGainControl;
    }

    return config;
  }
}
