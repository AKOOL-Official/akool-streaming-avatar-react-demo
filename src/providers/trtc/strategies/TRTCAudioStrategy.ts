import { AudioStrategy } from '../../../types/provider.interfaces';
import { AudioTrack } from '../../../types/streaming.types';
import { logger } from '../../../core/Logger';
import { ErrorMapper } from '../../../errors/ErrorMapper';

// TRTC SDK v5 client interface (simplified)
interface TRTCClient {
  startLocalAudio(quality?: number): Promise<void>;
  stopLocalAudio(): void;
  muteLocalAudio(mute: boolean): void;
  setAudioCaptureVolume(volume: number): void;
  getConnectionState(): 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';
}

export class TRTCAudioStrategy implements AudioStrategy {
  constructor(private client: TRTCClient) {}

  private isConnected(): boolean {
    return this.client.getConnectionState() === 'CONNECTED';
  }

  async createTrack(_constraints?: MediaTrackConstraints): Promise<AudioTrack> {
    try {
      if (!this.isConnected()) {
        throw new Error('TRTC client not connected');
      }

      // Start local audio with TRTC SDK
      await this.client.startLocalAudio();

      const trackId = `trtc-audio-${Date.now()}`;

      const audioTrack: AudioTrack = {
        id: trackId,
        kind: 'audio',
        enabled: true,
        muted: false,
        volume: 100,
      };

      logger.info('TRTC audio track created and started', { trackId });
      return audioTrack;
    } catch (error) {
      logger.error('Failed to create TRTC audio track', { error });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async publishTrack(track: AudioTrack): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('TRTC client not connected');
      }

      // TRTC v5 uses startLocalAudio() to publish audio
      await this.client.startLocalAudio();

      logger.info('TRTC audio track published', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to publish TRTC audio track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async unpublishTrack(track: AudioTrack): Promise<void> {
    try {
      this.client.stopLocalAudio();

      logger.info('TRTC audio track unpublished', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to unpublish TRTC audio track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async enableTrack(track: AudioTrack): Promise<void> {
    try {
      this.client.muteLocalAudio(false);

      logger.info('TRTC audio track enabled', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to enable TRTC audio track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async disableTrack(track: AudioTrack): Promise<void> {
    try {
      this.client.muteLocalAudio(true);

      logger.info('TRTC audio track disabled', { trackId: track.id });
    } catch (error) {
      logger.error('Failed to disable TRTC audio track', { error, trackId: track.id });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async muteAudioTrack(track: AudioTrack, muted: boolean): Promise<void> {
    try {
      this.client.muteLocalAudio(muted);

      logger.debug('TRTC audio track mute state changed', { trackId: track.id, muted });
    } catch (error) {
      logger.error('Failed to change TRTC audio track mute state', { error, trackId: track.id, muted });
      throw ErrorMapper.mapTRTCError(error);
    }
  }

  async setVolume(track: AudioTrack, volume: number): Promise<void> {
    try {
      if (volume < 0 || volume > 100) {
        throw new Error('Volume must be between 0 and 100');
      }

      this.client.setAudioCaptureVolume(volume);

      logger.debug('TRTC audio volume set', { trackId: track.id, volume });
    } catch (error) {
      logger.error('Failed to set TRTC audio volume', { error, trackId: track.id, volume });
      throw ErrorMapper.mapTRTCError(error);
    }
  }
}
