import { Room, LocalVideoTrack, createLocalVideoTrack, VideoCaptureOptions, VideoPresets } from 'livekit-client';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { VideoTrack, VideoConfig } from '../../../types/streaming.types';
import { LiveKitVideoControllerCallbacks } from '../types';

export class LiveKitVideoController {
  private room: Room;
  private currentTrack: LocalVideoTrack | null = null;
  private isEnabled = false;
  private callbacks: LiveKitVideoControllerCallbacks = {};

  constructor(room: Room) {
    this.room = room;
  }

  setCallbacks(callbacks: LiveKitVideoControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  async enableVideo(config: VideoConfig = {}): Promise<VideoTrack> {
    try {
      logger.info('Enabling video', { config });

      if (this.isEnabled && this.currentTrack) {
        logger.debug('Video already enabled, returning existing track');
        return this.convertToVideoTrack(this.currentTrack);
      }

      // Create video track with configuration
      const captureOptions: VideoCaptureOptions = {
        resolution: VideoPresets.h720.resolution,
        facingMode: 'user',
      };

      const videoTrack = await createLocalVideoTrack(captureOptions);

      // Publish the video track
      await this.room.localParticipant.publishTrack(videoTrack);

      this.currentTrack = videoTrack;
      this.isEnabled = true;

      const videoTrackInfo = this.convertToVideoTrack(videoTrack);

      logger.info('Video enabled successfully', {
        trackId: videoTrackInfo.id,
        enabled: videoTrackInfo.enabled,
      });

      this.callbacks.onVideoTrackPublished?.(videoTrackInfo);
      return videoTrackInfo;
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to enable video: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

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

      const trackId = this.currentTrack.sid || 'unknown';

      // Unpublish the track if room is connected
      if (this.room.state === 'connected') {
        await this.room.localParticipant.unpublishTrack(this.currentTrack);
      } else {
        logger.debug('Room not connected, skipping unpublish for video track');
      }

      // Stop the track
      this.currentTrack.stop();

      this.currentTrack = null;
      this.isEnabled = false;

      logger.info('Video disabled successfully', { trackId });

      this.callbacks.onVideoTrackUnpublished?.(trackId);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to disable video: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to disable video', {
        error: streamingError.message,
      });

      // Still mark as disabled even if there was an error
      this.isEnabled = false;
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async playVideo(elementId: string): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active video track to play');
      }

      const element = document.getElementById(elementId);
      if (!element) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, `Video element with id '${elementId}' not found`);
      }

      if (!(element instanceof HTMLVideoElement)) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, `Element '${elementId}' is not a video element`);
      }

      // Attach the track to the video element
      this.currentTrack.attach(element);

      logger.debug('Video track attached to element', {
        elementId,
        trackId: this.currentTrack.sid,
      });
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to play video: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to play video', {
        error: streamingError.message,
        elementId,
      });
      throw streamingError;
    }
  }

  async stopVideo(): Promise<void> {
    try {
      if (!this.currentTrack) {
        logger.debug('No active video track to stop');
        return;
      }

      // Detach the track from all video elements
      this.currentTrack.detach();

      logger.debug('Video track detached from all elements', {
        trackId: this.currentTrack.sid,
      });
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to stop video: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to stop video', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async publishVideo(track: VideoTrack): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No video track available to publish');
      }

      logger.info('Publishing video track', {
        trackId: track.id,
      });

      await this.room.localParticipant.publishTrack(this.currentTrack);

      logger.info('Video track published successfully', {
        trackId: track.id,
      });

      this.callbacks.onVideoTrackPublished?.(track);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to publish video track: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to publish video track', {
        error: streamingError.message,
      });

      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async unpublishVideo(): Promise<void> {
    try {
      if (!this.currentTrack) {
        logger.debug('No video track to unpublish');
        return;
      }

      const trackId = this.currentTrack.sid || 'unknown';

      logger.info('Unpublishing video track', { trackId });

      // Only unpublish if room is connected
      if (this.room.state === 'connected') {
        await this.room.localParticipant.unpublishTrack(this.currentTrack);
      } else {
        logger.debug('Room not connected, skipping unpublish for video track');
      }

      logger.info('Video track unpublished successfully');

      this.callbacks.onVideoTrackUnpublished?.(trackId);
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to unpublish video track: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to unpublish video track', {
        error: streamingError.message,
      });

      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async muteVideo(): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active video track to mute');
      }

      await this.currentTrack.mute();

      logger.debug('Video track muted');
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to mute video: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to mute video', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async unmuteVideo(): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'No active video track to unmute');
      }

      await this.currentTrack.unmute();

      logger.debug('Video track unmuted');
    } catch (error) {
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.MEDIA_DEVICE_ERROR,
              `Failed to unmute video: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

      logger.error('Failed to unmute video', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  private convertToVideoTrack(liveKitTrack: LocalVideoTrack): VideoTrack {
    return {
      id: liveKitTrack.sid || `video-${Date.now()}`,
      kind: 'video',
      enabled: !liveKitTrack.isMuted,
      muted: liveKitTrack.isMuted,
      source: 'camera', // LiveKit tracks are typically camera sources
    };
  }

  // Getters
  get videoEnabled(): boolean {
    return this.isEnabled;
  }

  get videoTrack(): VideoTrack | null {
    return this.currentTrack ? this.convertToVideoTrack(this.currentTrack) : null;
  }

  get nativeTrack(): LocalVideoTrack | null {
    return this.currentTrack;
  }

  // Check if there's an active video track
  hasActiveTrack(): boolean {
    return this.currentTrack !== null && this.isEnabled;
  }

  // Clean up method for proper resource management
  async cleanup(): Promise<void> {
    try {
      // Stop video playback
      if (this.currentTrack) {
        await this.stopVideo();
      }

      // Disable video track if enabled
      if (this.currentTrack) {
        await this.disableVideo();
      }

      // Clear all references
      this.callbacks = {};
    } catch (error) {
      logger.error('Error during video controller cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
