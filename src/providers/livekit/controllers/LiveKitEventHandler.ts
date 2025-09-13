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
} from 'livekit-client';
import { logger } from '../../../core/Logger';
import {
  Participant,
  ChatMessage,
  ConnectionQuality as UnifiedConnectionQuality,
} from '../../../types/streaming.types';

export class LiveKitEventHandler {
  private room: Room;

  constructor(room: Room) {
    this.room = room;
  }

  setupEventHandlers(): void {
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
    this.room.on(RoomEvent.DataReceived, this.handleDataReceived.bind(this));
    this.room.on(RoomEvent.Disconnected, this.handleDisconnected.bind(this));
    this.room.on(RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakersChanged.bind(this));
    this.room.on(RoomEvent.AudioPlaybackStatusChanged, this.handleAudioPlaybackStatusChanged.bind(this));

    logger.info('LiveKit event handlers set up');
  }

  removeEventHandlers(): void {
    this.room.removeAllListeners(RoomEvent.ParticipantConnected);
    this.room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    this.room.removeAllListeners(RoomEvent.TrackPublished);
    this.room.removeAllListeners(RoomEvent.TrackUnpublished);
    this.room.removeAllListeners(RoomEvent.TrackSubscribed);
    this.room.removeAllListeners(RoomEvent.TrackUnsubscribed);
    this.room.removeAllListeners(RoomEvent.ConnectionQualityChanged);
    this.room.removeAllListeners(RoomEvent.DataReceived);
    this.room.removeAllListeners(RoomEvent.Disconnected);
    this.room.removeAllListeners(RoomEvent.ActiveSpeakersChanged);
    this.room.removeAllListeners(RoomEvent.AudioPlaybackStatusChanged);

    logger.info('LiveKit event handlers removed');
  }

  private handleParticipantConnected(participant: RemoteParticipant): void {
    logger.debug('Participant connected', { identity: participant.identity });

    const newParticipant: Participant = {
      id: participant.sid,
      displayName: participant.identity,
      isLocal: false,
      audioTracks: [],
      videoTracks: [],
      connectionQuality: { score: 0, uplink: 'poor', downlink: 'poor', rtt: 0, packetLoss: 0 },
    };

    // Note: In the refactored architecture, these events would be handled by the main controller
    logger.info('Participant joined', { participant: newParticipant });
  }

  private handleParticipantDisconnected(participant: RemoteParticipant): void {
    logger.debug('Participant disconnected', { identity: participant.identity });

    // Note: In the refactored architecture, these events would be handled by the main controller
    logger.info('Participant left', { participantId: participant.identity });
  }

  private handleTrackPublished(publication: RemoteTrackPublication, _participant: RemoteParticipant): void {
    // Auto-subscribe to video tracks if not already subscribed
    if (publication.kind === 'video' && !publication.isSubscribed) {
      publication.setSubscribed(true);
    }
  }

  private handleTrackUnpublished(publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    logger.debug('Track unpublished', {
      trackSid: publication.trackSid,
      kind: publication.kind,
      participant: participant.identity,
    });
  }

  private handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ): void {
    // Handle remote video tracks - attach to the remote video element
    if (publication.kind === 'video' && track instanceof RemoteVideoTrack) {
      const remoteVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
      if (remoteVideoElement) {
        try {
          // Attach the remote video track to the element
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
        } catch (error) {
          logger.error('Failed to attach remote video track', { error });
        }
      }
    }
  }

  private handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ): void {
    // Handle remote video tracks - detach from the remote video element
    if (publication.kind === 'video' && track instanceof RemoteVideoTrack) {
      try {
        track.detach();
      } catch (error) {
        logger.error('Failed to detach remote video track', { error });
      }
    }
  }

  private handleConnectionQualityChanged(quality: ConnectionQuality, participant: LKParticipant): void {
    const unifiedQuality = this.convertConnectionQuality(quality);

    logger.debug('Connection quality changed', {
      quality: unifiedQuality,
      participant: participant.identity,
    });

    // Note: In the refactored architecture, this would be handled by the main controller
  }

  private handleDataReceived(payload: Uint8Array, participant: RemoteParticipant | undefined): void {
    try {
      const text = new TextDecoder().decode(payload);
      logger.debug('Data received', { length: payload.length, from: participant?.identity });

      // Try to parse as JSON for message handling
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        this.handleChatMessage(data, participant);
      } catch {
        // If not JSON, treat as plain text message
        this.handleSystemMessage({}, participant);
      }
    } catch (error) {
      logger.error('Error handling data received', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleChatMessage(data: Record<string, unknown>, participant: RemoteParticipant | undefined): void {
    const message: ChatMessage = {
      id: (data.id as string) || `msg-${Date.now()}`,
      content: (data.content as string) || (data.text as string) || '',
      timestamp: (data.timestamp as number) || Date.now(),
      fromParticipant: participant?.identity || 'system',
      type: 'text',
    };

    logger.info('Chat message received', { message });
  }

  private handleSystemMessage(data: Record<string, unknown>, participant: RemoteParticipant | undefined): void {
    logger.info('System message received', {
      message: data.text || 'System notification',
      context: { participant: participant?.identity, data },
    });
  }

  private handleDisconnected(reason?: DisconnectReason): void {
    logger.info('Room disconnected', { reason });

    // Note: In the refactored architecture, this would be handled by the main controller
  }

  private handleActiveSpeakersChanged(speakers: LKParticipant[]): void {
    logger.debug('Active speakers changed', { count: speakers.length });

    // Note: In the refactored architecture, this would be handled by the main controller
  }

  private handleAudioPlaybackStatusChanged(canPlayAudio: boolean): void {
    logger.debug('Audio playback status changed', { canPlayAudio });

    // Note: In the refactored architecture, this would be handled by the main controller
  }

  private convertConnectionQuality(quality: ConnectionQuality): UnifiedConnectionQuality {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return { score: 100, uplink: 'excellent', downlink: 'excellent', rtt: 30, packetLoss: 0 };
      case ConnectionQuality.Good:
        return { score: 75, uplink: 'good', downlink: 'good', rtt: 60, packetLoss: 1 };
      case ConnectionQuality.Poor:
        return { score: 50, uplink: 'fair', downlink: 'fair', rtt: 150, packetLoss: 5 };
      case ConnectionQuality.Lost:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt: 500, packetLoss: 20 };
      default:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt: 0, packetLoss: 0 };
    }
  }

  cleanup(): void {
    this.removeEventHandlers();
    logger.info('LiveKit event handler cleanup completed');
  }
}
