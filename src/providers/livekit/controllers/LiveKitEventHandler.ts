import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  ConnectionQuality,
  RemoteTrackPublication,
  Participant as LKParticipant,
  RemoteTrack,
  DisconnectReason,
} from 'livekit-client';
import { logger } from '../../../core/Logger';
import { EventBus } from '../../../core/EventBus';
import {
  Participant,
  ChatMessage,
  ConnectionQuality as UnifiedConnectionQuality,
} from '../../../types/streaming.types';

export class LiveKitEventHandler {
  private room: Room;
  private eventBus: EventBus;

  constructor(room: Room, eventBus: EventBus) {
    this.room = room;
    this.eventBus = eventBus;
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

    // Connection quality events
    this.room.on(RoomEvent.ConnectionQualityChanged, this.handleConnectionQualityChanged.bind(this));

    // Data events
    this.room.on(RoomEvent.DataReceived, this.handleDataReceived.bind(this));

    // Room state events
    this.room.on(RoomEvent.Disconnected, this.handleDisconnected.bind(this));
    this.room.on(RoomEvent.Reconnecting, this.handleReconnecting.bind(this));
    this.room.on(RoomEvent.Reconnected, this.handleReconnected.bind(this));

    // Audio events
    this.room.on(RoomEvent.AudioPlaybackStatusChanged, this.handleAudioPlaybackStatusChanged.bind(this));

    logger.debug('LiveKit event handlers set up successfully');
  }

  removeEventHandlers(): void {
    // Remove all event listeners
    this.room.removeAllListeners(RoomEvent.ParticipantConnected);
    this.room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    this.room.removeAllListeners(RoomEvent.TrackPublished);
    this.room.removeAllListeners(RoomEvent.TrackUnpublished);
    this.room.removeAllListeners(RoomEvent.TrackSubscribed);
    this.room.removeAllListeners(RoomEvent.TrackUnsubscribed);
    this.room.removeAllListeners(RoomEvent.ConnectionQualityChanged);
    this.room.removeAllListeners(RoomEvent.DataReceived);
    this.room.removeAllListeners(RoomEvent.Disconnected);
    this.room.removeAllListeners(RoomEvent.Reconnecting);
    this.room.removeAllListeners(RoomEvent.Reconnected);
    this.room.removeAllListeners(RoomEvent.AudioPlaybackStatusChanged);

    logger.debug('LiveKit event handlers removed');
  }

  private handleParticipantConnected(participant: RemoteParticipant): void {
    logger.info('LiveKit participant joined', {
      participantId: participant.identity,
      participantSid: participant.sid,
    });

    const newParticipant: Participant = {
      id: participant.identity,
      displayName: participant.name || participant.identity,
      isLocal: false,
      videoTracks: [],
      audioTracks: [],
      connectionQuality: this.convertConnectionQuality(participant.connectionQuality),
    };

    // Publish participant joined event
    this.eventBus.publish('participant:joined', { participant: newParticipant });
  }

  private handleParticipantDisconnected(participant: RemoteParticipant): void {
    logger.info('LiveKit participant left', {
      participantId: participant.identity,
      participantSid: participant.sid,
    });

    // Publish participant left event
    this.eventBus.publish('participant:left', { participantId: participant.identity });
  }

  private handleTrackPublished(publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    logger.debug('LiveKit track published', {
      trackSid: publication.trackSid,
      trackKind: publication.kind,
      participantId: participant.identity,
    });

    // Handle track publication events if needed
    // This could trigger UI updates for new tracks
  }

  private handleTrackUnpublished(publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    logger.debug('LiveKit track unpublished', {
      trackSid: publication.trackSid,
      trackKind: publication.kind,
      participantId: participant.identity,
    });

    // Handle track unpublication events if needed
  }

  private handleTrackSubscribed(
    _track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void {
    logger.debug('LiveKit track subscribed', {
      trackSid: publication.trackSid,
      trackKind: publication.kind,
      participantId: participant.identity,
    });

    // Handle track subscription - could trigger auto-play for video/audio
  }

  private handleTrackUnsubscribed(
    _track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void {
    logger.debug('LiveKit track unsubscribed', {
      trackSid: publication.trackSid,
      trackKind: publication.kind,
      participantId: participant.identity,
    });

    // Handle track unsubscription
  }

  private handleConnectionQualityChanged(quality: ConnectionQuality, participant: LKParticipant): void {
    const convertedQuality = this.convertConnectionQuality(quality);

    logger.debug('LiveKit connection quality changed', {
      quality,
      convertedQuality,
      participantId: participant.identity,
      isLocal: participant instanceof LocalParticipant,
    });

    // Publish connection quality change event
    this.eventBus.publish('connection:quality-changed', {
      quality: convertedQuality,
    });
  }

  private handleDataReceived(payload: Uint8Array, participant: RemoteParticipant | undefined): void {
    try {
      const data = JSON.parse(new TextDecoder().decode(payload));

      logger.debug('LiveKit data received', {
        dataType: data.type,
        participantId: participant?.identity,
        payloadSize: payload.length,
      });

      // Handle different types of data messages
      switch (data.type) {
        case 'chat':
          this.handleChatMessage(data, participant);
          break;
        case 'avatar_audio_start':
        case 'avatar_audio_end':
        case 'set_params':
        case 'set_params_ack':
        case 'interrupt':
        case 'interrupt_ack':
          this.handleSystemMessage(data, participant);
          break;
        default:
          logger.debug('Unknown data message type', { type: data.type, data });
      }
    } catch (error) {
      logger.warn('Failed to parse received data', {
        error: error instanceof Error ? error.message : String(error),
        participantId: participant?.identity,
      });
    }
  }

  private handleChatMessage(data: Record<string, unknown>, participant: RemoteParticipant | undefined): void {
    const message: ChatMessage = {
      id: (data.id as string) || `msg-${Date.now()}`,
      content: (data.content as string) || (data.text as string) || '',
      timestamp: (data.timestamp as number) || Date.now(),
      fromParticipant: participant?.identity || 'unknown',
      type: 'text',
    };

    logger.debug('Chat message received', {
      messageId: message.id,
      fromParticipant: message.fromParticipant,
      content: message.content,
    });

    // Publish message received event
    this.eventBus.publish('message:received', { message });
  }

  private handleSystemMessage(data: Record<string, unknown>, participant: RemoteParticipant | undefined): void {
    logger.debug('System message received', {
      messageType: data.type,
      fromParticipant: participant?.identity,
      data,
    });

    // Publish system message event
    this.eventBus.publish('system:info', {
      message: `System message received: ${data.type}`,
      context: {
        messageType: data.type,
        fromParticipant: participant?.identity,
        data,
      },
    });
  }

  private handleDisconnected(reason?: DisconnectReason): void {
    logger.info('LiveKit room disconnected', { reason });

    // Publish system disconnect event
    this.eventBus.publish('system:info', {
      message: 'Room disconnected',
      context: { reason },
    });
  }

  private handleReconnecting(): void {
    logger.info('LiveKit room reconnecting');

    // Publish system reconnecting event
    this.eventBus.publish('system:info', {
      message: 'Room reconnecting',
      context: { state: 'reconnecting' },
    });
  }

  private handleReconnected(): void {
    logger.info('LiveKit room reconnected');

    // Publish system reconnected event
    this.eventBus.publish('system:info', {
      message: 'Room reconnected',
      context: { state: 'reconnected' },
    });
  }

  private handleAudioPlaybackStatusChanged(canPlayAudio: boolean): void {
    logger.debug('LiveKit audio playback status changed', { canPlayAudio });

    // Publish audio playback status change
    this.eventBus.publish('system:info', {
      message: 'Audio playback status changed',
      context: { canPlayAudio },
    });
  }

  private convertConnectionQuality(quality: ConnectionQuality): UnifiedConnectionQuality {
    // Convert LiveKit connection quality to our unified format
    let qualityString = 'poor';
    let score = 25;

    switch (quality) {
      case ConnectionQuality.Excellent:
        qualityString = 'excellent';
        score = 100;
        break;
      case ConnectionQuality.Good:
        qualityString = 'good';
        score = 75;
        break;
      case ConnectionQuality.Poor:
        qualityString = 'poor';
        score = 50;
        break;
      case ConnectionQuality.Lost:
        qualityString = 'poor';
        score = 25;
        break;
      default:
        qualityString = 'poor';
        score = 25;
    }

    return {
      score,
      uplink: qualityString as 'excellent' | 'good' | 'fair' | 'poor',
      downlink: qualityString as 'excellent' | 'good' | 'fair' | 'poor',
      rtt: 0, // Would need to get from stats if available
      packetLoss: 0, // Would need to get from stats if available
    };
  }

  // Clean up method for proper resource management
  cleanup(): void {
    this.removeEventHandlers();
  }
}
