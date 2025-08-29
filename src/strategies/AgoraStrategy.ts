import AgoraRTC, { IMicrophoneAudioTrack, ICameraVideoTrack, IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { AudioStrategy, VideoStrategy, MediaStrategy, AudioTrack } from './interfaces';
import { VideoTrack } from '../types/streamingProvider';

export class AgoraAudioStrategy implements AudioStrategy {
  constructor(private client: IAgoraRTCClient) {}

  isConnected(): boolean {
    return this.client && this.client.connectionState === 'CONNECTED';
  }

  async createAudioTrack(): Promise<AudioTrack> {
    return await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: 'speech_low_quality',
      AEC: true,
      ANS: true,
      AGC: true,
    });
  }

  async publishAudioTrack(track: AudioTrack): Promise<void> {
    if (!track) return;
    const agoraTrack = track as IMicrophoneAudioTrack;
    if (agoraTrack) {
      await this.client.publish(agoraTrack);
    }
  }

  async unpublishAudioTrack(track: AudioTrack): Promise<void> {
    if (!track || !this.isConnected()) return;
    
    const agoraTrack = track as IMicrophoneAudioTrack;
    if (!agoraTrack) return;
    
    try {
      // Check if the track is in the published tracks list
      const publishedTracks = this.client.localTracks;
      if (publishedTracks.includes(agoraTrack)) {
        await this.client.unpublish(agoraTrack);
      }
    } catch (error) {
      // Ignore unpublish errors as they're not critical during cleanup
      console.warn('Failed to unpublish audio track (non-critical):', error);
    }
  }

  stopAudioTrack(track: AudioTrack): void {
    if (!track) return;
    const agoraTrack = track as IMicrophoneAudioTrack;
    if (agoraTrack && typeof agoraTrack.stop === 'function') {
      agoraTrack.stop();
    }
  }

  closeAudioTrack(track: AudioTrack): void {
    if (!track) return;
    const agoraTrack = track as IMicrophoneAudioTrack;
    if (agoraTrack && typeof agoraTrack.close === 'function') {
      agoraTrack.close();
    }
  }
}

export class AgoraVideoStrategy implements VideoStrategy {
  constructor(private client: IAgoraRTCClient) {}

  isConnected(): boolean {
    return this.client && this.client.connectionState === 'CONNECTED';
  }

  async createVideoTrack(): Promise<VideoTrack> {
    return await AgoraRTC.createCameraVideoTrack({
      encoderConfig: {
        width: 320,
        height: 240,
        frameRate: 15,
        bitrateMin: 200,
        bitrateMax: 500,
      },
    });
  }

  async enableVideoTrack(track: VideoTrack): Promise<void> {
    if (!track) return;
    const agoraTrack = track as ICameraVideoTrack;
    if (agoraTrack && typeof agoraTrack.setEnabled === 'function') {
      await agoraTrack.setEnabled(true);
    }
  }

  async disableVideoTrack(track: VideoTrack): Promise<void> {
    if (!track) return;
    const agoraTrack = track as ICameraVideoTrack;
    if (agoraTrack) {
      if (typeof agoraTrack.stop === 'function') {
        agoraTrack.stop();
      }
      if (typeof agoraTrack.setEnabled === 'function') {
        await agoraTrack.setEnabled(false);
      }
    }
  }

  stopVideoTrack(track: VideoTrack): void {
    if (!track) return;
    const agoraTrack = track as ICameraVideoTrack;
    if (agoraTrack && typeof agoraTrack.stop === 'function') {
      agoraTrack.stop();
    }
  }

  closeVideoTrack(track: VideoTrack): void {
    if (!track) return;
    const agoraTrack = track as ICameraVideoTrack;
    if (agoraTrack && typeof agoraTrack.close === 'function') {
      agoraTrack.close();
    }
  }

  playVideoTrack(track: VideoTrack, element: HTMLElement): void {
    if (!track || !element) return;
    const agoraTrack = track as ICameraVideoTrack;
    if (agoraTrack && typeof agoraTrack.play === 'function') {
      agoraTrack.play(element);
    }
  }

  stopVideoPlayback(track: VideoTrack): void {
    if (!track) return;
    const agoraTrack = track as ICameraVideoTrack;
    if (agoraTrack && typeof agoraTrack.stop === 'function') {
      agoraTrack.stop();
    }
  }
}

export class AgoraMediaStrategy implements MediaStrategy {
  public readonly audio: AudioStrategy;
  public readonly video: VideoStrategy;

  constructor(client: IAgoraRTCClient) {
    this.audio = new AgoraAudioStrategy(client);
    this.video = new AgoraVideoStrategy(client);
  }
}
