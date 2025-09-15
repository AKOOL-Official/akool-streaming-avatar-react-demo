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
  LocalParticipant,
  RemoteAudioTrack,
} from 'livekit-client';
import { logger } from '../../../core/Logger';
import {
  Participant,
  ChatMessage,
  ConnectionQuality as UnifiedConnectionQuality,
} from '../../../types/streaming.types';
import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../../types/provider.interfaces';
import { CommonMessageController } from '../../common/CommonMessageController';
import { LiveKitMessageAdapter } from '../adapters/LiveKitMessageAdapter';
import { MessageProviderConfig } from '../../common/types/message.types';

// Unified callback interface
export interface LiveKitEventHandlerCallbacks {
  // Event callbacks
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: UnifiedConnectionQuality) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;

  // Messaging callbacks
  onCommandSent?: (cmd: string, data?: Record<string, unknown>) => void;
  onCommandResponse?: (cmd: string, code: number, message?: string) => void;
  onMessageResponse?: (response: { text: string; from: 'bot' | 'user' }) => void;
  onSystemMessage?: (event: SystemMessageEvent) => void;
  onChatMessage?: (event: ChatMessageEvent) => void;
  onCommand?: (event: CommandEvent) => void;
}

export class LiveKitEventHandler {
  private room: Room;
  private callbacks: LiveKitEventHandlerCallbacks = {};
  private messageController: CommonMessageController;

  // LiveKit-specific configuration
  private static readonly LIVEKIT_CONFIG: MessageProviderConfig = {
    maxEncodedSize: 950, // Will be fixed later
    bytesPerSecond: 6000, // Will be fixed later
  };

  constructor(room: Room) {
    this.room = room;
    const messageAdapter = new LiveKitMessageAdapter(room);
    this.messageController = new CommonMessageController(messageAdapter, LiveKitEventHandler.LIVEKIT_CONFIG);
  }

  setCallbacks(callbacks: LiveKitEventHandlerCallbacks): void {
    this.callbacks = callbacks;

    // Delegate message callbacks to CommonMessageController
    this.messageController.setCallbacks({
      onParticipantJoined: callbacks.onParticipantJoined
        ? (participant) => callbacks.onParticipantJoined?.(participant as Participant)
        : undefined,
      onParticipantLeft: callbacks.onParticipantLeft,
      onConnectionQualityChanged: callbacks.onConnectionQualityChanged
        ? (quality) => callbacks.onConnectionQualityChanged?.(quality as UnifiedConnectionQuality)
        : undefined,
      onMessageReceived: callbacks.onMessageReceived
        ? (message) => callbacks.onMessageReceived?.(message as ChatMessage)
        : undefined,
      onError: callbacks.onError,
      onSpeakingStateChanged: callbacks.onSpeakingStateChanged,
      onCommandSent: callbacks.onCommandSent,
      onCommandResponse: callbacks.onCommandResponse,
      onMessageResponse: callbacks.onMessageResponse,
      onSystemMessage: callbacks.onSystemMessage
        ? (event) => callbacks.onSystemMessage?.(event as SystemMessageEvent)
        : undefined,
      onChatMessage: callbacks.onChatMessage
        ? (event) => callbacks.onChatMessage?.(event as ChatMessageEvent)
        : undefined,
      onCommand: callbacks.onCommand ? (event) => callbacks.onCommand?.(event as CommandEvent) : undefined,
    });
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
    this.room.removeAllListeners(RoomEvent.Disconnected);
    this.room.removeAllListeners(RoomEvent.ActiveSpeakersChanged);
    this.room.removeAllListeners(RoomEvent.AudioPlaybackStatusChanged);

    logger.info('LiveKit event handlers removed');
  }

  private handleParticipantConnected(participant: RemoteParticipant): void {
    try {
      logger.debug('LiveKit participant connected', {
        identity: participant.identity,
        sid: participant.sid,
      });

      const unifiedParticipant: Participant = this.convertToUnifiedParticipant(participant);
      this.callbacks.onParticipantJoined?.(unifiedParticipant);
    } catch (error) {
      logger.error('Error handling participant connected', {
        error: error instanceof Error ? error.message : String(error),
        identity: participant.identity,
      });
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleParticipantDisconnected(participant: RemoteParticipant): void {
    try {
      logger.debug('LiveKit participant disconnected', {
        identity: participant.identity,
        sid: participant.sid,
      });

      this.callbacks.onParticipantLeft?.(participant.sid);
    } catch (error) {
      logger.error('Error handling participant disconnected', {
        error: error instanceof Error ? error.message : String(error),
        identity: participant.identity,
      });
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleTrackPublished(publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    logger.debug('LiveKit track published', {
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
      try {
        // For audio tracks, we need to attach to an audio element or use attach() method
        // LiveKit audio tracks don't have a direct play() method
        const audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        document.body.appendChild(audioElement);

        publication.track.attach(audioElement);
        logger.info('Remote audio track started playing', {
          trackSid: publication.trackSid,
          participant: participant.identity,
        });
      } catch (error) {
        logger.error('Failed to play remote audio track', {
          error: error instanceof Error ? error.message : String(error),
          trackSid: publication.trackSid,
        });
        this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private handleTrackUnpublished(): void {
    // Track unpublication handling can be delegated to specific controllers
    logger.debug('LiveKit track unpublished');
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
    try {
      const unifiedQuality = this.convertConnectionQuality(quality);
      logger.debug('LiveKit connection quality changed', {
        quality: unifiedQuality,
        participant: participant.identity,
        originalQuality: quality,
      });
      this.callbacks.onConnectionQualityChanged?.(unifiedQuality);
    } catch (error) {
      logger.error('Error handling connection quality change', {
        error: error instanceof Error ? error.message : String(error),
        participant: participant.identity,
        quality,
      });
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Message handling is now delegated to CommonMessageController

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

  private convertToUnifiedParticipant(participant: RemoteParticipant | LocalParticipant): Participant {
    return {
      id: participant.sid,
      displayName: participant.identity,
      isLocal: participant instanceof LocalParticipant,
      audioTracks: [], // Will be populated by track controllers
      videoTracks: [], // Will be populated by track controllers
      connectionQuality: { score: 0, uplink: 'poor', downlink: 'poor', rtt: 0, packetLoss: 0 }, // Will be updated by connection quality events
    };
  }

  private convertConnectionQuality(quality: ConnectionQuality): UnifiedConnectionQuality {
    // Use real RTT data if available, otherwise fall back to estimated values
    const rtt = this.getEstimatedRTT(quality);
    const packetLoss = this.getEstimatedPacketLoss(quality);

    switch (quality) {
      case ConnectionQuality.Excellent:
        return { score: 100, uplink: 'excellent', downlink: 'excellent', rtt, packetLoss };
      case ConnectionQuality.Good:
        return { score: 75, uplink: 'good', downlink: 'good', rtt, packetLoss };
      case ConnectionQuality.Poor:
        return { score: 50, uplink: 'fair', downlink: 'fair', rtt, packetLoss };
      case ConnectionQuality.Lost:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt, packetLoss };
      case ConnectionQuality.Unknown:
      default:
        return { score: 0, uplink: 'poor', downlink: 'poor', rtt, packetLoss };
    }
  }

  private getEstimatedRTT(quality: ConnectionQuality): number {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 30;
      case ConnectionQuality.Good:
        return 60;
      case ConnectionQuality.Poor:
        return 150;
      case ConnectionQuality.Lost:
        return 500;
      default:
        return 0;
    }
  }

  private getEstimatedPacketLoss(quality: ConnectionQuality): number {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 0;
      case ConnectionQuality.Good:
        return 1;
      case ConnectionQuality.Poor:
        return 5;
      case ConnectionQuality.Lost:
        return 20;
      default:
        return 0;
    }
  }

  cleanup(): void {
    this.removeEventHandlers();
    this.messageController.cleanup();
    this.callbacks = {};
    logger.info('LiveKit event handler cleanup completed');
  }
}
