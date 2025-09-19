import {
  Room,
  RoomEvent,
  RemoteParticipant,
  ConnectionQuality,
  RemoteTrackPublication,
  Participant as LKParticipant,
  RemoteTrack,
  RemoteVideoTrack,
  DisconnectReason,
  RemoteAudioTrack,
} from 'livekit-client';
import { logger } from '../../../core/Logger';
import { BaseEventController, BaseEventControllerCallbacks } from '../../common/controllers/BaseEventController';
import { BaseParticipantController } from '../../common/controllers/BaseParticipantController';
import { NetworkStats } from '../../../components/NetworkQuality';

// LiveKit-specific event controller callbacks
export interface LiveKitEventControllerCallbacks extends BaseEventControllerCallbacks {
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
}

export class LiveKitEventController extends BaseEventController {
  private room: Room;
  private participantController: BaseParticipantController;

  constructor(room: Room, participantController: BaseParticipantController) {
    super();
    this.room = room;
    this.participantController = participantController;
  }

  setCallbacks(callbacks: LiveKitEventControllerCallbacks): void {
    super.setCallbacks(callbacks);
  }

  setupEventListeners(): void {
    if (this.isListening) return;

    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected.bind(this));
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected.bind(this));

    // Track events
    this.room.on(RoomEvent.TrackPublished, this.handleTrackPublished.bind(this));
    this.room.on(RoomEvent.TrackUnpublished, this.handleTrackUnpublished.bind(this));
    this.room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed.bind(this));
    this.room.on(RoomEvent.TrackUnsubscribed, this.handleTrackUnsubscribed.bind(this));

    // Connection events
    this.room.on(RoomEvent.ConnectionQualityChanged, this.handleConnectionQualityChanged.bind(this));
    this.room.on(RoomEvent.Disconnected, this.handleDisconnected.bind(this));
    this.room.on(RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakersChanged.bind(this));
    this.room.on(RoomEvent.AudioPlaybackStatusChanged, this.handleAudioPlaybackStatusChanged.bind(this));

    this.isListening = true;
    logger.info('LiveKit event handlers set up');
  }

  removeEventListeners(): void {
    if (!this.isListening) return;

    this.room.removeAllListeners(RoomEvent.ParticipantConnected);
    this.room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    this.room.removeAllListeners(RoomEvent.TrackPublished);
    this.room.removeAllListeners(RoomEvent.TrackUnpublished);
    this.room.removeAllListeners(RoomEvent.TrackSubscribed);
    this.room.removeAllListeners(RoomEvent.TrackUnsubscribed);
    this.room.removeAllListeners(RoomEvent.ConnectionQualityChanged);
    this.room.removeAllListeners(RoomEvent.Disconnected);
    this.room.removeAllListeners(RoomEvent.ActiveSpeakersChanged);
    this.room.removeAllListeners(RoomEvent.AudioPlaybackStatusChanged);

    this.isListening = false;
    logger.info('LiveKit event handlers removed');
  }

  // Event handling methods
  private handleParticipantConnected(participant: RemoteParticipant): void {
    try {
      this.logEvent('participant-connected', {
        identity: participant.identity,
        sid: participant.sid,
      });

      const unifiedParticipant = this.participantController.convertToUnifiedParticipant(participant);
      this.participantController.addParticipant(unifiedParticipant);
    } catch (error) {
      this.handleError(error, 'handleParticipantConnected');
    }
  }

  private handleParticipantDisconnected(participant: RemoteParticipant): void {
    try {
      this.logEvent('participant-disconnected', {
        identity: participant.identity,
        sid: participant.sid,
      });

      this.participantController.removeParticipant(participant.sid);
    } catch (error) {
      this.handleError(error, 'handleParticipantDisconnected');
    }
  }

  private handleTrackPublished(publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    try {
      this.logEvent('track-published', {
        trackSid: publication.trackSid,
        kind: publication.kind,
        participant: participant.identity,
      });

      // Auto-subscribe to video tracks if not already subscribed
      if (publication.kind === 'video' && !publication.isSubscribed) {
        publication.setSubscribed(true);
      }

      // Handle remote audio track playback
      if (publication.kind === 'audio' && publication.track instanceof RemoteAudioTrack) {
        this.setupAudioTrackPlayback(publication.track, participant);
      }
    } catch (error) {
      this.handleError(error, 'handleTrackPublished');
    }
  }

  private handleTrackUnpublished(): void {
    this.logEvent('track-unpublished');
  }

  private handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ): void {
    try {
      this.logEvent('track-subscribed', {
        trackSid: publication.trackSid,
        kind: publication.kind,
      });

      // Handle remote video tracks - attach to the remote video element
      if (publication.kind === 'video' && track instanceof RemoteVideoTrack) {
        this.setupVideoTrackPlayback(track);
      }
    } catch (error) {
      this.handleError(error, 'handleTrackSubscribed');
    }
  }

  private handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ): void {
    try {
      this.logEvent('track-unsubscribed', {
        trackSid: publication.trackSid,
        kind: publication.kind,
      });

      // Handle remote video tracks - detach from the remote video element
      if (publication.kind === 'video' && track instanceof RemoteVideoTrack) {
        track.detach();
      }
    } catch (error) {
      this.handleError(error, 'handleTrackUnsubscribed');
    }
  }

  private handleConnectionQualityChanged(quality: ConnectionQuality, participant: LKParticipant): void {
    try {
      this.logEvent('connection-quality-changed', {
        quality,
        participant: participant.identity,
      });

      const unifiedQuality = this.participantController.convertConnectionQuality(quality);
      this.updateConnectionQuality(unifiedQuality);

      // Update participant's connection quality
      this.participantController.updateParticipantConnectionQuality(participant.sid, unifiedQuality);
    } catch (error) {
      this.handleError(error, 'handleConnectionQualityChanged');
    }
  }

  private handleDisconnected(reason?: DisconnectReason): void {
    this.logEvent('disconnected', { reason });
  }

  private handleActiveSpeakersChanged(speakers: LKParticipant[]): void {
    try {
      this.logEvent('active-speakers-changed', { count: speakers.length });

      // Update speaking state for all participants
      const allParticipants = this.participantController.getAllParticipants();

      allParticipants.forEach((participant) => {
        const isSpeaking = speakers.some((speaker) => speaker.sid === participant.id);
        this.participantController.updateParticipantSpeakingState(participant.id, isSpeaking);
      });

      // Update global speaking state
      const hasActiveSpeakers = speakers.length > 0;
      this.updateSpeakingState(hasActiveSpeakers);
    } catch (error) {
      this.handleError(error, 'handleActiveSpeakersChanged');
    }
  }

  private handleAudioPlaybackStatusChanged(canPlayAudio: boolean): void {
    this.logEvent('audio-playback-status-changed', { canPlayAudio });
  }

  // Helper methods
  private setupAudioTrackPlayback(track: RemoteAudioTrack, participant: RemoteParticipant): void {
    try {
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      audioElement.volume = 1.0;
      document.body.appendChild(audioElement);

      track.attach(audioElement);

      this.logEvent('audio-track-playback-started', {
        trackSid: track.sid,
        participant: participant.identity,
      });
    } catch (error) {
      this.handleError(error, 'setupAudioTrackPlayback');
    }
  }

  private setupVideoTrackPlayback(track: RemoteVideoTrack): void {
    try {
      const remoteVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
      if (remoteVideoElement) {
        track.attach(remoteVideoElement);

        // Start playing the video
        remoteVideoElement.play().catch(() => {
          // Autoplay might fail in some browsers, this is normal
        });

        // Trigger state detection events
        setTimeout(() => {
          remoteVideoElement.dispatchEvent(new Event('canplay'));
          remoteVideoElement.dispatchEvent(new Event('playing'));
        }, 100);

        this.logEvent('video-track-playback-started', {
          trackSid: track.sid,
        });
      }
    } catch (error) {
      this.handleError(error, 'setupVideoTrackPlayback');
    }
  }

  cleanup(): void {
    this.removeEventListeners();
    this.callbacks = {};
    logger.info('LiveKit event controller cleanup completed');
  }
}
