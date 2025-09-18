import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { VideoTrack, VideoConfig } from '../../../types/streaming.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { TRTCVideoControllerCallbacks } from '../types';
import { TRTCConnectionController } from './TRTCConnectionController';
import TRTC from 'trtc-sdk-v5';

export class TRTCVideoController {
  private client: TRTC;
  private currentTrack: VideoTrack | null = null;
  private isEnabled = false;
  private isMuted = false;
  private currentElement: HTMLElement | null = null;
  private callbacks: TRTCVideoControllerCallbacks = {};
  private connectionController: TRTCConnectionController | null = null;

  constructor(client: TRTC) {
    this.client = client;
  }

  setConnectionController(controller: TRTCConnectionController): void {
    this.connectionController = controller;
  }

  setCallbacks(callbacks: TRTCVideoControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  async enableVideo(config: VideoConfig = {}): Promise<VideoTrack> {
    try {
      if (this.isEnabled && this.currentTrack) {
        return this.currentTrack;
      }

      // Check connection state
      if (this.connectionController && !this.connectionController.isConnectionActive()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Must be connected to a room before enabling video', {
          provider: 'trtc',
        });
      }

      // Request camera permissions
      await this.requestCameraPermission();

      // Start local video
      await this.client.startLocalVideo({
        option: {
          useFrontCamera: true,
          mirror: true,
        },
      });

      // Update video encoder parameters
      const encoderParam = this.mapVideoConfig(config);
      await this.client.updateLocalVideo({ option: encoderParam });

      // Create track representation
      const trackId = `trtc-video-${Date.now()}`;
      this.currentTrack = {
        id: trackId,
        kind: 'video',
        enabled: true,
        muted: false,
        source: 'camera',
      };

      this.isEnabled = true;
      this.isMuted = false;

      this.callbacks.onVideoTrackPublished?.(this.currentTrack);

      return this.currentTrack;
    } catch (error) {
      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async disableVideo(): Promise<void> {
    try {
      if (!this.isEnabled) {
        return;
      }

      this.client.stopLocalVideo();

      const trackId = this.currentTrack?.id;
      this.currentTrack = null;
      this.currentElement = null;
      this.isEnabled = false;
      this.isMuted = false;

      if (trackId) {
        this.callbacks.onVideoTrackUnpublished?.(trackId);
      }
    } catch (error) {
      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async playVideo(elementId: string): Promise<void> {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new StreamingError(ErrorCode.ELEMENT_NOT_FOUND, `Video element not found: ${elementId}`, {
          provider: 'trtc',
          elementId,
        });
      }

      if (!this.isEnabled) {
        throw new StreamingError(ErrorCode.TRACK_NOT_FOUND, 'Video not enabled', { provider: 'trtc' });
      }

      if (this.currentElement === element) {
        return;
      }

      await this.client.updateLocalVideo({
        view: element,
        option: {
          mirror: true,
        },
      });

      this.currentElement = element;
    } catch (error) {
      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async stopVideo(): Promise<void> {
    if (this.currentElement) {
      this.currentElement = null;
    }
  }

  async publishVideo(): Promise<void> {
    if (!this.isEnabled) {
      await this.enableVideo();
    }
  }

  async unpublishVideo(): Promise<void> {
    return this.disableVideo();
  }

  async muteVideo(muted: boolean): Promise<void> {
    if (!this.isEnabled) {
      throw new StreamingError(ErrorCode.TRACK_NOT_FOUND, 'Video not enabled', { provider: 'trtc' });
    }

    await this.client.updateLocalVideo({ publish: !muted });
    this.isMuted = muted;

    if (this.currentTrack) {
      this.currentTrack.muted = muted;
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.isEnabled) {
      throw new StreamingError(ErrorCode.TRACK_NOT_FOUND, 'Video not enabled', { provider: 'trtc' });
    }
    // TRTC v5 doesn't support direct camera switching
    throw new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Camera switching not supported in TRTC v5', {
      provider: 'trtc',
    });
  }

  getCurrentTrack(): VideoTrack | null {
    return this.currentTrack;
  }

  isVideoEnabled(): boolean {
    return this.isEnabled;
  }

  isVideoMuted(): boolean {
    return this.isMuted;
  }

  getCurrentElement(): HTMLElement | null {
    return this.currentElement;
  }

  private async requestCameraPermission(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15 },
      },
    });

    // Stop the test stream immediately as we only needed it for permission
    stream.getTracks().forEach((track) => track.stop());
  }

  private mapVideoConfig(config: VideoConfig): Record<string, unknown> {
    const param: Record<string, unknown> = {
      enableAdjustRes: true,
      enableAdjustBitrate: true,
      videoFillMode: 'FILL',
    };

    // Set resolution based on config
    if (config.width && config.height) {
      if (config.width >= 1280 && config.height >= 720) {
        param.videoResolution = 'VIDEO_720P';
        param.videoBitrate = 1200;
      } else if (config.width >= 640 && config.height >= 480) {
        param.videoResolution = 'VIDEO_480P';
        param.videoBitrate = 600;
      } else {
        param.videoResolution = 'VIDEO_360P';
        param.videoBitrate = 400;
      }
    } else {
      param.videoResolution = 'VIDEO_480P';
      param.videoBitrate = 600;
    }

    // Set frame rate
    param.videoFps = config.frameRate ? Math.min(Math.max(config.frameRate, 10), 30) : 15;

    return param;
  }

  async playRemoteVideo(userId: string, element: HTMLElement): Promise<void> {
    try {
      logger.info('Starting remote video playback', {
        userId,
        elementId: element.id,
        elementTag: element.tagName,
        elementVisible: element.offsetWidth > 0 && element.offsetHeight > 0,
        hasHiddenClass: element.classList.contains('hidden'),
      });

      // Remove hidden class to make the video element visible
      element.classList.remove('hidden');

      await this.client.startRemoteVideo({ userId, streamType: TRTC.TYPE.STREAM_TYPE_MAIN, view: element }); // main stream

      logger.info('Remote video playback started successfully', {
        userId,
        elementVisible: element.offsetWidth > 0 && element.offsetHeight > 0,
        hasHiddenClass: element.classList.contains('hidden'),
      });
    } catch (error) {
      logger.error('Failed to start remote video playback', { error, userId });
      throw new StreamingError(ErrorCode.VIDEO_PLAYBACK_FAILED, 'Failed to start remote video playback', {
        provider: 'trtc',
        userId,
        originalError: error,
      });
    }
  }

  async stopRemoteVideo(userId: string): Promise<void> {
    try {
      logger.info('Stopping remote video playback', { userId });
      await this.client.stopRemoteVideo({ userId, streamType: TRTC.TYPE.STREAM_TYPE_MAIN }); // main stream

      // Add hidden class back to hide the video element
      const remoteVideoElement = document.getElementById('remote-video');
      if (remoteVideoElement) {
        remoteVideoElement.classList.add('hidden');
        logger.info('Added hidden class to remote video element', {
          userId,
          elementVisible: remoteVideoElement.offsetWidth > 0 && remoteVideoElement.offsetHeight > 0,
          hasHiddenClass: remoteVideoElement.classList.contains('hidden'),
        });
      } else {
        logger.warn('Remote video element not found when stopping', { userId });
      }

      logger.info('Remote video playback stopped successfully', { userId });
    } catch (error) {
      logger.error('Failed to stop remote video playback', { error, userId });
      throw new StreamingError(ErrorCode.VIDEO_PLAYBACK_FAILED, 'Failed to stop remote video playback', {
        provider: 'trtc',
        userId,
        originalError: error,
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up TRTC video controller');

      // Note: Video-specific events are not available as TRTC.EVENT constants

      // Disable video if enabled
      if (this.isEnabled) {
        await this.disableVideo();
      }

      this.callbacks = {};
      this.currentTrack = null;
      this.currentElement = null;

      logger.info('TRTC video controller cleanup completed');
    } catch (error) {
      logger.error('Error during TRTC video controller cleanup', { error });
    }
  }
}
