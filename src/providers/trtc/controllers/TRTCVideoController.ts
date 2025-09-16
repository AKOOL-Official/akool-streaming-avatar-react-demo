import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { VideoTrack, VideoConfig } from '../../../types/streaming.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { TRTCVideoControllerCallbacks } from '../types';

// TRTC SDK v5 client interface (simplified)
interface TRTCVideoEncParam {
  videoResolution?: string;
  videoFps?: number;
  videoBitrate?: number;
  enableAdjustRes?: boolean;
}

interface TRTCVideoConfig {
  view?: HTMLElement | string;
  option?: {
    mirror?: boolean;
    objectFit?: string;
  };
}

interface TRTCClient {
  startLocalVideo(config?: TRTCVideoConfig): Promise<void>;
  stopLocalVideo(): void;
  muteLocalVideo(mute: boolean): void;
  setVideoEncoderParam(param: TRTCVideoEncParam): void;
  startRemoteView(userId: string, streamType: number, view: HTMLElement): void;
  stopRemoteView(userId: string, streamType: number): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
}

export class TRTCVideoController {
  private client: TRTCClient;
  private currentTrack: VideoTrack | null = null;
  private isEnabled = false;
  private isMuted = false;
  private currentElement: HTMLElement | null = null;
  private callbacks: TRTCVideoControllerCallbacks = {};

  constructor(client: TRTCClient) {
    this.client = client;
    this.setupEventHandlers();
  }

  setCallbacks(callbacks: TRTCVideoControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  async enableVideo(config: VideoConfig = {}): Promise<VideoTrack> {
    try {
      logger.info('Enabling TRTC video', { config });

      if (this.isEnabled && this.currentTrack) {
        logger.debug('TRTC video already enabled');
        return this.currentTrack;
      }

      // Set video encoder parameters
      const encoderParam = this.mapVideoConfig(config);
      this.client.setVideoEncoderParam(encoderParam);

      // Start local video without view first
      await this.client.startLocalVideo();

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

      logger.info('TRTC video enabled successfully', { trackId });
      return this.currentTrack;
    } catch (error) {
      logger.error('Failed to enable TRTC video', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async disableVideo(): Promise<void> {
    try {
      if (!this.isEnabled) {
        logger.debug('TRTC video already disabled');
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

      logger.info('TRTC video disabled successfully');
    } catch (error) {
      logger.error('Failed to disable TRTC video', { error });

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

      // Start local video with the target element
      await this.client.startLocalVideo({
        view: element,
        option: {
          mirror: true,
          objectFit: 'cover',
        },
      });

      this.currentElement = element;

      logger.info('TRTC video playback started', { elementId });
    } catch (error) {
      logger.error('Failed to start TRTC video playback', { error, elementId });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async stopVideo(): Promise<void> {
    try {
      if (!this.isEnabled) {
        logger.debug('TRTC video not enabled');
        return;
      }

      // Stop local video rendering but keep capture active
      if (this.currentElement) {
        this.currentElement = null;
      }

      logger.info('TRTC video playback stopped');
    } catch (error) {
      logger.error('Failed to stop TRTC video playback', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async publishVideo(): Promise<void> {
    try {
      if (!this.isEnabled) {
        await this.enableVideo();
      }

      logger.debug('TRTC video published automatically with enableVideo');
    } catch (error) {
      logger.error('Failed to publish TRTC video', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async unpublishVideo(): Promise<void> {
    return this.disableVideo();
  }

  async muteVideo(muted: boolean): Promise<void> {
    try {
      if (!this.isEnabled) {
        throw new StreamingError(ErrorCode.TRACK_NOT_FOUND, 'Video not enabled', { provider: 'trtc' });
      }

      this.client.muteLocalVideo(muted);
      this.isMuted = muted;

      if (this.currentTrack) {
        this.currentTrack.muted = muted;
      }

      logger.debug('TRTC video mute state changed', { muted });
    } catch (error) {
      logger.error('Failed to change TRTC video mute state', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
  }

  async switchCamera(): Promise<void> {
    try {
      if (!this.isEnabled) {
        throw new StreamingError(ErrorCode.TRACK_NOT_FOUND, 'Video not enabled', { provider: 'trtc' });
      }

      // TRTC doesn't have a direct camera switch method in v5
      // Would need to stop and restart with different device
      logger.info('Camera switching not directly supported in TRTC v5');
    } catch (error) {
      logger.error('Failed to switch TRTC camera', { error });

      const streamingError = ErrorMapper.mapTRTCError(error);
      this.callbacks.onVideoError?.(streamingError);
      throw streamingError;
    }
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

  private mapVideoConfig(config: VideoConfig): TRTCVideoEncParam {
    const param: TRTCVideoEncParam = {
      enableAdjustRes: true,
    };

    // Map resolution
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

    // Map frame rate
    if (config.frameRate) {
      param.videoFps = Math.min(config.frameRate, 30);
    } else {
      param.videoFps = 15;
    }

    return param;
  }

  private setupEventHandlers(): void {
    this.client.on('onFirstVideoFrame', (...args: unknown[]) => {
      const [userId, , width, height] = args as [string, number, number, number];
      if (userId === '') {
        // Local user
        logger.info('TRTC local video first frame', { width, height });
        this.callbacks.onVideoResize?.(width, height);
      }
    });

    this.client.on('onVideoSizeChanged', (...args: unknown[]) => {
      const [userId, , newWidth, newHeight] = args as [string, number, number, number];
      if (userId === '') {
        // Local user
        logger.info('TRTC local video size changed', { newWidth, newHeight });
        this.callbacks.onVideoResize?.(newWidth, newHeight);
      }
    });

    this.client.on('onCameraDidReady', () => {
      logger.info('TRTC camera ready');
    });

    this.client.on('onVideoDeviceStateChanged', (...args: unknown[]) => {
      const [deviceId, deviceType, deviceState] = args as [string, number, number];
      logger.info('TRTC video device state changed', { deviceId, deviceType, deviceState });
    });
  }

  async playRemoteVideo(userId: string, element: HTMLElement): Promise<void> {
    try {
      logger.info('Starting remote video playback', { userId });
      this.client.startRemoteView(userId, 0, element); // 0 = main stream
      logger.info('Remote video playback started successfully', { userId });
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
      this.client.stopRemoteView(userId, 0); // 0 = main stream
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

      // Remove event listeners
      this.client.off('onFirstVideoFrame');
      this.client.off('onVideoSizeChanged');
      this.client.off('onCameraDidReady');
      this.client.off('onVideoDeviceStateChanged');

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
