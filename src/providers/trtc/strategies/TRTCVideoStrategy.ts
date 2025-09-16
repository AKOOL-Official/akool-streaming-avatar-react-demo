import { VideoStrategy } from '../../../types/provider.interfaces';
import { VideoTrack } from '../../../types/streaming.types';
import { logger } from '../../../core/Logger';
import { ErrorMapper } from '../../../errors/ErrorMapper';

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
  getConnectionState(): 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';
}

export class TRTCVideoStrategy implements VideoStrategy {
  constructor(private client: TRTCClient) {}

  private isConnected(): boolean {
    return this.client.getConnectionState() === 'CONNECTED';
  }

  async createTrack(_constraints?: MediaTrackConstraints): Promise<VideoTrack> {
    try {
      if (!this.isConnected()) {
        throw new Error('TRTC client not connected');
      }

      // Start local video with TRTC SDK
      await this.client.startLocalVideo();

      const trackId = `trtc-video-${Date.now()}`;

      const videoTrack: VideoTrack = {
        id: trackId,
        kind: 'video',
        enabled: true,
        muted: false,
        source: 'camera',
      };

      logger.info('TRTC video track created and started', { trackId });
      return videoTrack;
    } catch (error) {
      logger.error('Failed to create TRTC video track', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async publishTrack(track: VideoTrack): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('TRTC client not connected');
      }

      // Set default video parameters
      this.client.setVideoEncoderParam({
        videoResolution: 'VIDEO_480P',
        videoFps: 15,
        videoBitrate: 600,
        enableAdjustRes: true,
      });

      await this.client.startLocalVideo();

      logger.info('TRTC video track enabled', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to enable TRTC video track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async unpublishTrack(track: VideoTrack): Promise<void> {
    try {
      this.client.stopLocalVideo();

      logger.info('TRTC video track disabled', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to disable TRTC video track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async playTrack(track: VideoTrack, element: HTMLElement): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('TRTC client not connected');
      }

      // Start local video with the target element
      await this.client.startLocalVideo({
        view: element,
        option: {
          mirror: true,
          objectFit: 'cover',
        },
      });

      logger.info('TRTC video track playing', { trackId: track.id, elementId: element.id });
    } catch (error) {
      logger.error('Failed to play TRTC video track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async stopTrack(track: VideoTrack): Promise<void> {
    try {
      this.client.stopLocalVideo();

      logger.info('TRTC video track stopped', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to stop TRTC video track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async muteVideoTrack(track: VideoTrack, muted: boolean): Promise<void> {
    try {
      this.client.muteLocalVideo(muted);

      logger.debug('TRTC video track mute state changed', { trackId: track.id, muted });
    } catch (error) {
      logger.error('Failed to change TRTC video track mute state', { error, trackId: track.id, muted });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async setVideoQuality(track: VideoTrack, quality: 'low' | 'medium' | 'high'): Promise<void> {
    try {
      const params = this.mapQualityToParams(quality);
      this.client.setVideoEncoderParam(params);

      logger.info('TRTC video quality set', { trackId: track.id, quality, params });
    } catch (error) {
      logger.error('Failed to set TRTC video quality', { error, trackId: track.id, quality });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  private mapQualityToParams(quality: 'low' | 'medium' | 'high'): TRTCVideoEncParam {
    switch (quality) {
      case 'low':
        return {
          videoResolution: 'VIDEO_360P',
          videoFps: 15,
          videoBitrate: 400,
          enableAdjustRes: true,
        };
      case 'medium':
        return {
          videoResolution: 'VIDEO_480P',
          videoFps: 15,
          videoBitrate: 600,
          enableAdjustRes: true,
        };
      case 'high':
        return {
          videoResolution: 'VIDEO_720P',
          videoFps: 30,
          videoBitrate: 1200,
          enableAdjustRes: true,
        };
      default:
        return {
          videoResolution: 'VIDEO_480P',
          videoFps: 15,
          videoBitrate: 600,
          enableAdjustRes: true,
        };
    }
  }
}
