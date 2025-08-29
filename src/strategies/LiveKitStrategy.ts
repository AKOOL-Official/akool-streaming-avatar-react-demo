import { LocalAudioTrack, LocalVideoTrack, createLocalAudioTrack, createLocalVideoTrack, Room } from 'livekit-client';
import { AudioStrategy, VideoStrategy, MediaStrategy, AudioTrack } from './interfaces';
import { VideoTrack } from '../types/streamingProvider';

export class LiveKitAudioStrategy implements AudioStrategy {
  constructor(private room: Room) {}

  isConnected(): boolean {
    return this.room && this.room.state === 'connected';
  }

  async createAudioTrack(): Promise<AudioTrack> {
    try {
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      
      return audioTrack;
    } catch (error) {
      console.error('Failed to create LiveKit audio track:', error);
      throw error;
    }
  }

  async publishAudioTrack(track: AudioTrack): Promise<void> {
    if (!track) return;
    const livekitTrack = track as LocalAudioTrack;
    if (!livekitTrack) return;
    
    // Ensure audio track is unmuted before publishing
    if (livekitTrack.isMuted) {
      await livekitTrack.unmute();
    }
    
    // Check if already published to avoid duplicate publishing
    const audioPublications = Array.from(this.room.localParticipant.audioTrackPublications.values());
    const isAlreadyPublished = audioPublications.some(pub => pub.track === livekitTrack);
    
    if (isAlreadyPublished) {
      return;
    }
    
    try {
      await this.room.localParticipant.publishTrack(livekitTrack);
    } catch (error) {
      console.error('Failed to publish audio track to LiveKit room:', error);
      throw error;
    }
  }

  async unpublishAudioTrack(track: AudioTrack): Promise<void> {
    if (!track || !this.isConnected()) return;
    
    const livekitTrack = track as LocalAudioTrack;
    if (!livekitTrack) return;
    
    try {
      // Check if the track is actually published by looking at track publications
      const audioPublications = Array.from(this.room.localParticipant.audioTrackPublications.values());
      const isPublished = audioPublications.some(pub => pub.track === livekitTrack);
      
      if (isPublished) {
        await this.room.localParticipant.unpublishTrack(livekitTrack);
      }
    } catch (error) {
      // Ignore unpublish errors as they're not critical during cleanup
      console.warn('Failed to unpublish audio track (non-critical):', error);
    }
  }

  stopAudioTrack(track: AudioTrack): void {
    if (!track) return;
    const livekitTrack = track as LocalAudioTrack;
    if (livekitTrack && typeof livekitTrack.stop === 'function') {
      livekitTrack.stop();
    }
  }

  closeAudioTrack(track: AudioTrack): void {
    if (!track) return;
    // LiveKit tracks don't have a separate close method
    const livekitTrack = track as LocalAudioTrack;
    if (livekitTrack && typeof livekitTrack.stop === 'function') {
      livekitTrack.stop();
    }
  }
}

export class LiveKitVideoStrategy implements VideoStrategy {
  constructor(private room: Room) {}

  isConnected(): boolean {
    return this.room && this.room.state === 'connected';
  }

  async createVideoTrack(): Promise<VideoTrack> {
    try {
      const videoTrack = await createLocalVideoTrack({
        resolution: {
          width: 320,
          height: 240,
          frameRate: 15,
        },
      });
      
      return videoTrack;
    } catch (error) {
      console.error('Failed to create LiveKit video track:', error);
      throw error;
    }
  }

  async enableVideoTrack(track: VideoTrack): Promise<void> {
    if (!track) return;
    const livekitTrack = track as LocalVideoTrack;
    if (livekitTrack) {
      if (livekitTrack.isMuted) {
        await livekitTrack.unmute();
      }
      
      // Publish the video track to the room if connected and not already published
      if (this.isConnected()) {
        const videoPublications = Array.from(this.room.localParticipant.videoTrackPublications.values());
        const isAlreadyPublished = videoPublications.some(pub => pub.track === livekitTrack);
        
        if (!isAlreadyPublished) {
          try {
            await this.room.localParticipant.publishTrack(livekitTrack);
          } catch (error) {
            console.warn('Failed to publish video track (non-critical):', error);
          }
        }
      }
    }
  }

  async disableVideoTrack(track: VideoTrack): Promise<void> {
    if (!track) return;
    const livekitTrack = track as LocalVideoTrack;
    if (livekitTrack && typeof livekitTrack.mute === 'function') {
      await livekitTrack.mute();
      
      // Unpublish the video track from the room when disabled
      if (this.isConnected()) {
        const videoPublications = Array.from(this.room.localParticipant.videoTrackPublications.values());
        const isPublished = videoPublications.some(pub => pub.track === livekitTrack);
        
        if (isPublished) {
          try {
            await this.room.localParticipant.unpublishTrack(livekitTrack);
          } catch (error) {
            console.warn('Failed to unpublish video track (non-critical):', error);
          }
        }
      }
    }
  }

  stopVideoTrack(track: VideoTrack): void {
    if (!track) return;
    const livekitTrack = track as LocalVideoTrack;
    if (livekitTrack && typeof livekitTrack.stop === 'function') {
      livekitTrack.stop();
    }
  }

  closeVideoTrack(track: VideoTrack): void {
    if (!track) return;
    const livekitTrack = track as LocalVideoTrack;
    if (livekitTrack && typeof livekitTrack.stop === 'function') {
      livekitTrack.stop();
    }
  }

  playVideoTrack(track: VideoTrack, element: HTMLElement): void {
    if (!track || !element) return;
    const livekitTrack = track as LocalVideoTrack;
    if (!livekitTrack || typeof livekitTrack.attach !== 'function') return;
    
    // For LiveKit, we need to find or create a video element within the container
    let videoElement = element.querySelector('video') as HTMLVideoElement;
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.controls = false;
      element.appendChild(videoElement);
    }
    
    // Detach any existing track first to avoid conflicts
    if (videoElement.srcObject) {
      livekitTrack.detach();
    }
    
    // Attach the track to the video element
    livekitTrack.attach(videoElement);
    
    // Ensure the video starts playing
    videoElement.play().catch(error => {
      console.warn('Failed to start video playback (non-critical):', error);
    });
  }

  stopVideoPlayback(track: VideoTrack): void {
    if (!track) return;
    const livekitTrack = track as LocalVideoTrack;
    if (livekitTrack && typeof livekitTrack.detach === 'function') {
      livekitTrack.detach();
    }
  }
}

export class LiveKitMediaStrategy implements MediaStrategy {
  public readonly audio: AudioStrategy;
  public readonly video: VideoStrategy;

  constructor(room: Room) {
    this.audio = new LiveKitAudioStrategy(room);
    this.video = new LiveKitVideoStrategy(room);
  }
}
