import { VideoStrategy } from '../../../types/provider.interfaces';
import { VideoTrack } from '../../../types/streaming.types';
import { AgoraVideoController } from '../controllers/AgoraVideoController';
import { logger } from '../../../core/Logger';

export class AgoraVideoStrategy implements VideoStrategy {
  private videoController: AgoraVideoController;

  constructor(videoController: AgoraVideoController) {
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

      await this.videoController.publishVideo();

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
      logger.debug('Playing video track', { trackId: track.id, elementId: element.id });

      // Ensure the element has an ID for Agora to use
      const elementId = element.id || `video-${track.id}`;
      if (!element.id) {
        element.id = elementId;
      }

      await this.videoController.playVideo(elementId);

      logger.info('Video track playing successfully', { trackId: track.id, elementId });
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

  // Helper method to map MediaTrackConstraints to Agora-specific config
  private mapConstraintsToConfig(constraints?: MediaTrackConstraints): Record<string, unknown> {
    if (!constraints) {
      return {
        width: 640,
        height: 480,
        frameRate: 15,
        bitrate: 1000,
        facingMode: 'user',
      };
    }

    const videoConfig: Record<string, unknown> = {
      facingMode: 'user',
    };

    // Map width constraint
    if (constraints.width) {
      if (typeof constraints.width === 'number') {
        videoConfig.width = constraints.width;
      } else if (typeof constraints.width === 'object') {
        videoConfig.width = constraints.width.ideal || constraints.width.max || 640;
      }
    } else {
      videoConfig.width = 640;
    }

    // Map height constraint
    if (constraints.height) {
      if (typeof constraints.height === 'number') {
        videoConfig.height = constraints.height;
      } else if (typeof constraints.height === 'object') {
        videoConfig.height = constraints.height.ideal || constraints.height.max || 480;
      }
    } else {
      videoConfig.height = 480;
    }

    // Map frame rate constraint
    if (constraints.frameRate) {
      if (typeof constraints.frameRate === 'number') {
        videoConfig.frameRate = constraints.frameRate;
      } else if (typeof constraints.frameRate === 'object') {
        videoConfig.frameRate = constraints.frameRate.ideal || constraints.frameRate.max || 15;
      }
    } else {
      videoConfig.frameRate = 15;
    }

    // Map facing mode constraint
    if (constraints.facingMode) {
      if (typeof constraints.facingMode === 'string') {
        videoConfig.facingMode = constraints.facingMode;
      } else if (typeof constraints.facingMode === 'object') {
        const facingModeObj = constraints.facingMode as unknown as { ideal?: string };
        videoConfig.facingMode =
          facingModeObj.ideal ||
          (Array.isArray(constraints.facingMode) ? constraints.facingMode[0] : undefined) ||
          'user';
      }
    }

    // Map device ID constraint
    if (constraints.deviceId) {
      if (typeof constraints.deviceId === 'string') {
        videoConfig.deviceId = constraints.deviceId;
      } else if (typeof constraints.deviceId === 'object') {
        const deviceIdObj = constraints.deviceId as unknown as { ideal?: string; exact?: string };
        videoConfig.deviceId = deviceIdObj.ideal || deviceIdObj.exact;
      }
    }

    // Calculate bitrate based on resolution
    const width = Number(videoConfig.width) || 640;
    const height = Number(videoConfig.height) || 480;
    const pixelCount = width * height;
    if (pixelCount >= 1920 * 1080) {
      videoConfig.bitrate = 2000; // 1080p
    } else if (pixelCount >= 1280 * 720) {
      videoConfig.bitrate = 1500; // 720p
    } else if (pixelCount >= 640 * 480) {
      videoConfig.bitrate = 1000; // 480p
    } else {
      videoConfig.bitrate = 500; // Lower resolutions
    }

    logger.debug('Mapped video constraints to config', {
      constraints,
      config: videoConfig,
    });

    return videoConfig;
  }

  // Additional methods specific to video

  // Switch camera (front/back)
  async switchCamera(): Promise<void> {
    try {
      await this.videoController.switchCamera();
      logger.info('Camera switched successfully');
    } catch (error) {
      logger.error('Failed to switch camera', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Enable/disable video
  async setVideoEnabled(track: VideoTrack, enabled: boolean): Promise<void> {
    try {
      await this.videoController.setVideoEnabled(enabled);
      logger.info('Video enabled state changed', { trackId: track.id, enabled });
    } catch (error) {
      logger.error('Failed to set video enabled state', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
        enabled,
      });
      throw error;
    }
  }

  // Check if video is currently enabled
  isEnabled(): boolean {
    return this.videoController.videoEnabled;
  }

  // Check if video is currently published
  isPublished(): boolean {
    return this.videoController.videoPublished;
  }

  // Get the current video track
  getCurrentTrack(): VideoTrack | null {
    return this.videoController.videoTrack;
  }

  // Get available camera devices
  async getCameraDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await this.videoController.getCameraDevices();
      logger.debug('Retrieved camera devices', { deviceCount: devices.length });
      return devices;
    } catch (error) {
      logger.error('Failed to get camera devices', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Create track with specific device
  async createTrackWithDevice(deviceId: string, constraints?: MediaTrackConstraints): Promise<VideoTrack> {
    const config = this.mapConstraintsToConfig(constraints);
    config.deviceId = deviceId;

    try {
      const videoTrack = await this.videoController.enableVideo(config);
      logger.info('Video track created with specific device', {
        trackId: videoTrack.id,
        deviceId,
      });
      return videoTrack;
    } catch (error) {
      logger.error('Failed to create video track with device', {
        error: error instanceof Error ? error.message : String(error),
        deviceId,
      });
      throw error;
    }
  }

  // Disable video track (stop and close)
  async disableTrack(track: VideoTrack): Promise<void> {
    try {
      await this.videoController.disableVideo();
      logger.info('Video track disabled successfully', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to disable video track', {
        error: error instanceof Error ? error.message : String(error),
        trackId: track.id,
      });
      throw error;
    }
  }
}
