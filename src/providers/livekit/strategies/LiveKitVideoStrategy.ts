import { VideoStrategy } from '../../../types/provider.interfaces';
import { VideoTrack } from '../../../types/streaming.types';
import { LiveKitVideoController } from '../controllers/LiveKitVideoController';
import { logger } from '../../../core/Logger';

export class LiveKitVideoStrategy implements VideoStrategy {
  private videoController: LiveKitVideoController;

  constructor(videoController: LiveKitVideoController) {
    this.videoController = videoController;
  }

  async createTrack(constraints?: MediaTrackConstraints): Promise<VideoTrack> {
    try {
      logger.debug('Creating video track with constraints', { constraints });

      const config = this.mapConstraintsToConfig(constraints);
      const videoTrack = await this.videoController.enableVideo(config);

      logger.info('Video track created successfully', {
        trackId: videoTrack.id,
        enabled: videoTrack.enabled,
      });

      return videoTrack;
    } catch (error) {
      logger.error('Failed to create video track', {
        error: error instanceof Error ? error.message : String(error),
        constraints,
      });
      throw error;
    }
  }

  async publishTrack(track: VideoTrack): Promise<void> {
    try {
      logger.debug('Publishing video track', { trackId: track.id });

      if (!this.videoController.hasActiveTrack()) {
        // Enable video if not already active
        await this.videoController.enableVideo();
      }

      // The video controller automatically publishes when enabled
      logger.info('Video track published successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to publish video track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async unpublishTrack(track: VideoTrack): Promise<void> {
    try {
      logger.debug('Unpublishing video track', { trackId: track.id });

      await this.videoController.unpublishVideo();

      logger.info('Video track unpublished successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to unpublish video track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async playTrack(track: VideoTrack, element: HTMLElement): Promise<void> {
    try {
      logger.debug('Playing video track', { trackId: track.id });

      await this.videoController.playVideo(element.id);

      logger.info('Video track playing successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to play video track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async stopTrack(track: VideoTrack): Promise<void> {
    try {
      logger.debug('Stopping video track', { trackId: track.id });

      await this.videoController.stopVideo();

      logger.info('Video track stopped successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to stop video track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async replaceTrack(oldTrack: VideoTrack, newTrack: VideoTrack): Promise<void> {
    try {
      logger.debug('Replacing video track', {
        oldTrackId: oldTrack.id,
        newTrackId: newTrack.id,
      });

      // Unpublish old track
      await this.unpublishTrack(oldTrack);

      // Publish new track
      await this.publishTrack(newTrack);

      logger.info('Video track replaced successfully', {
        oldTrackId: oldTrack.id,
        newTrackId: newTrack.id,
      });
    } catch (error) {
      logger.error('Failed to replace video track', {
        error: error instanceof Error ? error.message : String(error),
        oldTrackId: oldTrack.id,
        newTrackId: newTrack.id,
      });
      throw error;
    }
  }

  async switchCamera(track: VideoTrack): Promise<VideoTrack> {
    try {
      logger.debug('Switching camera for video track', { trackId: track.id });

      // For LiveKit, camera switching would involve recreating the track
      // with different facingMode constraints
      const currentConstraints: MediaTrackConstraints = {
        facingMode: track.source === 'camera' ? 'environment' : 'user',
      };

      const newTrack = await this.createTrack(currentConstraints);
      await this.replaceTrack(track, newTrack);

      logger.info('Camera switched successfully', {
        oldTrackId: track.id,
        newTrackId: newTrack.id,
      });

      return newTrack;
    } catch (error) {
      logger.error('Failed to switch camera', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }

  async startScreenShare(): Promise<VideoTrack> {
    try {
      logger.debug('Starting screen share');

      // Create screen share track with display media constraints
      const constraints: MediaTrackConstraints = {
        // Note: screen capture constraints would be handled differently in LiveKit
        // This is a simplified approach
        width: { min: 1280 },
        height: { min: 720 },
        frameRate: { max: 30 },
      };

      const screenTrack = await this.createTrack(constraints);

      logger.info('Screen share started successfully', {
        trackId: screenTrack.id,
      });

      return screenTrack;
    } catch (error) {
      logger.error('Failed to start screen share', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async stopScreenShare(track: VideoTrack): Promise<void> {
    try {
      logger.debug('Stopping screen share', { trackId: track.id });

      await this.unpublishTrack(track);
      await this.videoController.stopVideo();

      logger.info('Screen share stopped successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to stop screen share', {
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
    const config: Record<string, unknown> = {};

    // Map MediaTrackConstraints to LiveKit video config
    if (constraints.width !== undefined) {
      config.width = constraints.width;
    }

    if (constraints.height !== undefined) {
      config.height = constraints.height;
    }

    if (constraints.frameRate !== undefined) {
      config.frameRate = constraints.frameRate;
    }

    if (constraints.facingMode !== undefined) {
      config.facingMode = constraints.facingMode;
    }

    if (constraints.deviceId !== undefined) {
      config.deviceId = constraints.deviceId;
    }

    return config;
  }
}
