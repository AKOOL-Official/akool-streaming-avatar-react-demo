import { VideoStrategy } from '../../../types/provider.interfaces';
import { VideoTrack } from '../../../types/streaming.types';
import { logger } from '../../../core/Logger';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import TRTC from 'trtc-sdk-v5';

export class TRTCVideoStrategy implements VideoStrategy {
  constructor(private client: TRTC) {}

  private isConnected(): boolean {
    // Note: We should check the actual connection state from the connection controller
    // For now, we'll assume connected if we can call methods without errors
    // In a real implementation, this should be injected from the connection controller
    return true;
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
      await this.client.updateLocalVideo({
        option: {
          profile: '480p',
        },
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
      await this.client.updateLocalVideo({ publish: !muted });

      logger.debug('TRTC video track mute state changed', { trackId: track.id, muted });
    } catch (error) {
      logger.error('Failed to change TRTC video track mute state', { error, trackId: track.id, muted });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async setVideoQuality(track: VideoTrack, quality: 'low' | 'medium' | 'high'): Promise<void> {
    try {
      const params = this.mapQualityToParams(quality);
      await this.client.updateLocalVideo({ option: params as Record<string, string> });

      logger.info('TRTC video quality set', { trackId: track.id, quality, params });
    } catch (error) {
      logger.error('Failed to set TRTC video quality', { error, trackId: track.id, quality });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  private mapQualityToParams(quality: 'low' | 'medium' | 'high'): Record<string, unknown> {
    switch (quality) {
      case 'low':
        return {
          profile: '240p',
        };
      case 'medium':
        return {
          profile: '480p',
        };
      case 'high':
        return {
          profile: '720p',
        };
      default:
        return {
          profile: '480p',
        };
    }
  }
}
