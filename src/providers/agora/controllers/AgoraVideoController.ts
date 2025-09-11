import { IAgoraRTCClient, ILocalVideoTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { VideoTrack } from '../../../types/streaming.types';

export interface VideoControllerCallbacks {
  onVideoTrackPublished?: (track: VideoTrack) => void;
  onVideoTrackUnpublished?: (trackId: string) => void;
  onVideoError?: (error: StreamingError) => void;
}

export interface VideoConfig {
  width?: number;
  height?: number;
  frameRate?: number;
  bitrate?: number;
  facingMode?: 'user' | 'environment';
  deviceId?: string;
}

export class AgoraVideoController {
  private client: IAgoraRTCClient;
  private currentTrack: ILocalVideoTrack | null = null;
  private isEnabled = false;
  private isPublished = false;
  private callbacks: VideoControllerCallbacks = {};

  constructor(client: IAgoraRTCClient) {
    this.client = client;
  }

  setCallbacks(callbacks: VideoControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  async enableVideo(config: VideoConfig = {}): Promise<VideoTrack> {
    try {
      logger.info('Enabling video', { config });

      if (this.isEnabled && this.currentTrack) {
        logger.debug('Video already enabled, returning existing track');
        return this.convertToVideoTrack(this.currentTrack);
      }

      // Create camera video track with configuration
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: config.width || 640,
          height: config.height || 480,
          frameRate: config.frameRate || 15,
          bitrateMin: config.bitrate ? config.bitrate * 0.8 : 500,
          bitrateMax: config.bitrate || 1000,
        },
        facingMode: config.facingMode || 'user',
        cameraId: config.deviceId,
      });

      this.currentTrack = videoTrack;
      this.isEnabled = true;

      const videoTrackInfo = this.convertToVideoTrack(videoTrack);

      logger.info('Video enabled successfully', {
        trackId: videoTrackInfo.id,
        enabled: videoTrackInfo.enabled,
        resolution: `${config.width || 640}x${config.height || 480}`,
      });

      this.callbacks.onVideoTrackPublished?.(videoTrackInfo);
      return videoTrackInfo;
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to enable video', {
        error: streamingError.message,
        config,
      });

      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async disableVideo(): Promise<void> {
    try {
      logger.info('Disabling video');

      if (!this.isEnabled || !this.currentTrack) {
        logger.debug('Video already disabled');
        return;
      }

      const trackId = this.currentTrack.getTrackId();

      // Unpublish if published
      if (this.isPublished) {
        await this.unpublishVideo();
      }

      // Stop and close the track
      this.currentTrack.stop();
      this.currentTrack.close();

      this.currentTrack = null;
      this.isEnabled = false;

      logger.info('Video disabled successfully', { trackId });

      this.callbacks.onVideoTrackUnpublished?.(trackId);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to disable video', {
        error: streamingError.message,
      });

      // Still mark as disabled even if there was an error
      this.isEnabled = false;
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async publishVideo(externalTrack?: ILocalVideoTrack): Promise<void> {
    try {
      const trackToPublish = externalTrack || this.currentTrack;

      if (!trackToPublish) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No video track available to publish');
      }

      logger.info('Publishing video track', {
        trackId: trackToPublish.getTrackId(),
        isExternal: !!externalTrack,
      });

      // If using external track, update our reference
      if (externalTrack) {
        // Unpublish current track if published
        if (this.isPublished && this.currentTrack) {
          await this.client.unpublish(this.currentTrack);
        }
        this.currentTrack = externalTrack;
        this.isEnabled = true;
      }

      await this.client.publish(trackToPublish);
      this.isPublished = true;

      logger.info('Video track published successfully', {
        trackId: trackToPublish.getTrackId(),
      });

      const videoTrackInfo = this.convertToVideoTrack(trackToPublish);
      this.callbacks.onVideoTrackPublished?.(videoTrackInfo);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to publish video track', {
        error: streamingError.message,
      });

      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async unpublishVideo(): Promise<void> {
    try {
      if (!this.currentTrack || !this.isPublished) {
        logger.debug('No video track to unpublish');
        return;
      }

      logger.info('Unpublishing video track', {
        trackId: this.currentTrack.getTrackId(),
      });

      await this.client.unpublish(this.currentTrack);
      this.isPublished = false;

      logger.info('Video track unpublished successfully');

      this.callbacks.onVideoTrackUnpublished?.(this.currentTrack.getTrackId());
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to unpublish video track', {
        error: streamingError.message,
      });

      // Still mark as unpublished even if there was an error
      this.isPublished = false;
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async switchCamera(): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No camera track available for switching');
      }

      logger.info('Switching camera');

      const cameraTrack = this.currentTrack as ICameraVideoTrack;
      // Use type assertion since switchDevice might not be in the type definition
      await (cameraTrack as unknown as { switchDevice?: () => Promise<void> }).switchDevice?.();

      logger.info('Camera switched successfully');
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to switch camera', {
        error: streamingError.message,
      });

      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async setVideoEnabled(enabled: boolean): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active video track to enable/disable');
      }

      await this.currentTrack.setEnabled(enabled);

      logger.debug('Video track enabled state changed', { enabled });
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to set video enabled state', {
        error: streamingError.message,
        enabled,
      });
      throw streamingError;
    }
  }

  async playVideo(elementId: string): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active video track to play');
      }

      this.currentTrack.play(elementId);

      logger.debug('Video track playing in element', { elementId });
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to play video track', {
        error: streamingError.message,
        elementId,
      });
      throw streamingError;
    }
  }

  async stopVideo(): Promise<void> {
    try {
      if (!this.currentTrack) {
        logger.debug('No video track to stop');
        return;
      }

      this.currentTrack.stop();

      logger.debug('Video track stopped');
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to stop video track', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  private convertToVideoTrack(agoraTrack: ILocalVideoTrack): VideoTrack {
    return {
      id: agoraTrack.getTrackId(),
      kind: 'video',
      enabled: agoraTrack.enabled,
      muted: agoraTrack.muted,
      source: 'camera',
    };
  }

  // Getters
  get videoEnabled(): boolean {
    return this.isEnabled;
  }

  get videoPublished(): boolean {
    return this.isPublished;
  }

  get videoTrack(): VideoTrack | null {
    return this.currentTrack ? this.convertToVideoTrack(this.currentTrack) : null;
  }

  get nativeTrack(): ILocalVideoTrack | null {
    return this.currentTrack;
  }

  // Check if there's an active video track
  hasActiveTrack(): boolean {
    return this.currentTrack !== null && this.isEnabled;
  }

  // Get available camera devices
  async getCameraDevices(): Promise<MediaDeviceInfo[]> {
    try {
      return await AgoraRTC.getCameras();
    } catch (error) {
      logger.error('Failed to get camera devices', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    try {
      if (this.currentTrack) {
        await this.disableVideo();
      }
      this.callbacks = {};
    } catch (error) {
      logger.error('Error during video controller cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
