import { IAgoraRTCClient, IAgoraRTCRemoteUser, NetworkQuality } from 'agora-rtc-sdk-ng';
import { UID } from 'agora-rtc-sdk-ng/esm';
import { logger } from '../../../core/Logger';
import { StreamingError } from '../../../types/error.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { Participant, ConnectionQuality, ChatMessage } from '../../../types/streaming.types';
import { NetworkStats } from '../../../components/NetworkQuality';
import { StreamMessage, CommandResponsePayload, ChatResponsePayload } from './AgoraMessagingController';

export interface AgoraEventCallbacks {
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onCommandResponse?: (cmd: string, code: number, message?: string) => void;
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
  onError?: (error: StreamingError) => void;
}

export class AgoraEventController {
  private client: IAgoraRTCClient;
  private callbacks: AgoraEventCallbacks = {};
  private isListening = false;

  constructor(client: IAgoraRTCClient) {
    this.client = client;
  }

  startListening(callbacks: AgoraEventCallbacks): void {
    if (this.isListening) {
      this.stopListening();
    }

    this.callbacks = callbacks;
    this.setupEventListeners();
    this.isListening = true;

    logger.info('Started listening to Agora events');
  }

  stopListening(): void {
    if (!this.isListening) return;

    this.removeEventListeners();
    this.callbacks = {};
    this.isListening = false;

    logger.info('Stopped listening to Agora events');
  }

  private setupEventListeners(): void {
    // User media events
    this.client.on('user-published', this.handleUserPublished.bind(this));
    this.client.on('user-unpublished', this.handleUserUnpublished.bind(this));
    this.client.on('user-joined', this.handleUserJoined.bind(this));
    this.client.on('user-left', this.handleUserLeft.bind(this));

    // Network quality events
    this.client.on('network-quality', this.handleNetworkQuality.bind(this));

    // Stream message events (for avatar communication)
    this.client.on('stream-message', this.handleStreamMessage.bind(this));

    // Exception handling
    this.client.on('exception', this.handleException.bind(this));
  }

  private removeEventListeners(): void {
    this.client.removeAllListeners('user-published');
    this.client.removeAllListeners('user-unpublished');
    this.client.removeAllListeners('user-joined');
    this.client.removeAllListeners('user-left');
    this.client.removeAllListeners('network-quality');
    this.client.removeAllListeners('stream-message');
    this.client.removeAllListeners('exception');
  }

  private async handleUserPublished(
    user: IAgoraRTCRemoteUser,
    mediaType: 'video' | 'audio' | 'datachannel',
  ): Promise<void> {
    try {
      logger.info('User published media', {
        userId: user.uid,
        mediaType,
        hasVideoTrack: !!user.videoTrack,
        hasAudioTrack: !!user.audioTrack,
      });

      if (mediaType === 'video') {
        const remoteTrack = await this.client.subscribe(user, mediaType);

        // Auto-play video to the remote-video container
        remoteTrack.play('remote-video', { fit: 'contain' });

        logger.debug('Subscribed to remote video track', {
          userId: user.uid,
          trackId: remoteTrack.getTrackId(),
        });
      } else if (mediaType === 'audio') {
        const remoteTrack = await this.client.subscribe(user, mediaType);

        // Auto-play audio
        remoteTrack.play();

        logger.debug('Subscribed to remote audio track', {
          userId: user.uid,
          trackId: remoteTrack.getTrackId(),
        });
      }

      // Create participant object and notify
      const participant = this.createParticipantFromUser(user);
      this.callbacks.onParticipantJoined?.(participant);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to handle user published event', {
        userId: user.uid,
        mediaType,
        error: streamingError.message,
      });
      this.callbacks.onError?.(streamingError);
    }
  }

  private async handleUserUnpublished(
    user: IAgoraRTCRemoteUser,
    mediaType: 'video' | 'audio' | 'datachannel',
  ): Promise<void> {
    try {
      logger.info('User unpublished media', {
        userId: user.uid,
        mediaType,
      });

      await this.client.unsubscribe(user, mediaType);

      logger.debug('Unsubscribed from remote track', {
        userId: user.uid,
        mediaType,
      });

      // Create updated participant object and notify
      const participant = this.createParticipantFromUser(user);
      this.callbacks.onParticipantJoined?.(participant); // Update the participant
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to handle user unpublished event', {
        userId: user.uid,
        mediaType,
        error: streamingError.message,
      });
      this.callbacks.onError?.(streamingError);
    }
  }

  private handleUserJoined(user: IAgoraRTCRemoteUser): void {
    logger.info('User joined channel', { userId: user.uid });

    const participant = this.createParticipantFromUser(user);
    this.callbacks.onParticipantJoined?.(participant);
  }

  private handleUserLeft(user: IAgoraRTCRemoteUser, reason: string): void {
    logger.info('User left channel', { userId: user.uid, reason });

    this.callbacks.onParticipantLeft?.(String(user.uid));
  }

  private handleNetworkQuality(stats: NetworkQuality): void {
    try {
      // Get comprehensive network statistics
      const videoStats = this.client.getRemoteVideoStats();
      const audioStats = this.client.getRemoteAudioStats();
      const networkStats = this.client.getRemoteNetworkQuality();

      // Get the first remote user's stats (typically the avatar)
      const firstVideoStats = Object.values(videoStats)[0] || {};
      const firstAudioStats = Object.values(audioStats)[0] || {};
      const firstNetworkStats = Object.values(networkStats)[0] || {};

      const networkStatsUpdate: NetworkStats = {
        localNetwork: stats,
        remoteNetwork: firstNetworkStats,
        video: firstVideoStats,
        audio: firstAudioStats,
      };

      // Convert to our unified ConnectionQuality format
      const connectionQuality: ConnectionQuality = {
        score: this.mapQualityToScore(stats.downlinkNetworkQuality || 0),
        uplink: this.mapQualityToString(stats.uplinkNetworkQuality || 0),
        downlink: this.mapQualityToString(stats.downlinkNetworkQuality || 0),
        rtt: (firstNetworkStats as unknown as { rtt?: number })?.rtt || 0,
        packetLoss: ((firstNetworkStats as unknown as { packetLoss?: number })?.packetLoss || 0) * 100, // Convert to percentage
      };

      this.callbacks.onNetworkStatsUpdate?.(networkStatsUpdate);
      this.callbacks.onConnectionQualityChanged?.(connectionQuality);
    } catch (error) {
      logger.warn('Failed to process network quality stats', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleStreamMessage(uid: UID, body: Uint8Array): void {
    try {
      const messageString = new TextDecoder().decode(body);
      logger.debug('Received stream message', {
        fromUserId: uid,
        messageSize: body.length,
        messagePreview: messageString.substring(0, 100),
      });

      const streamMessage = JSON.parse(messageString) as StreamMessage;

      if (streamMessage.v !== 2) {
        logger.warn('Unsupported message version', { version: streamMessage.v });
        return;
      }

      if (streamMessage.type === 'command') {
        this.handleCommandResponse(streamMessage.pld as CommandResponsePayload);
      } else if (streamMessage.type === 'chat') {
        this.handleChatResponse(streamMessage, String(uid));
      } else {
        logger.warn('Unknown message type', { type: streamMessage.type });
      }
    } catch (error) {
      logger.error('Failed to process stream message', {
        fromUserId: uid,
        messageSize: body.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleCommandResponse(payload: CommandResponsePayload): void {
    logger.info('Received command response', {
      command: payload.cmd,
      code: payload.code,
      message: payload.msg,
    });

    this.callbacks.onCommandResponse?.(payload.cmd, payload.code, payload.msg);

    // Alert user if command failed
    if (payload.code !== 1000) {
      logger.warn('Command execution failed', {
        command: payload.cmd,
        code: payload.code,
        message: payload.msg,
      });
    }
  }

  private handleChatResponse(streamMessage: StreamMessage, fromUserId: string): void {
    const payload = streamMessage.pld as ChatResponsePayload;

    const chatMessage: ChatMessage = {
      id: streamMessage.mid || `msg-${Date.now()}`,
      content: payload.text,
      timestamp: Date.now(),
      fromParticipant: fromUserId,
      type: 'text',
    };

    logger.debug('Received chat message', {
      messageId: chatMessage.id,
      fromUserId,
      contentLength: payload.text.length,
      messageType: payload.from,
    });

    this.callbacks.onMessageReceived?.(chatMessage);
  }

  private handleException(e: { code: number; msg: string; uid: UID }): void {
    logger.error('Agora exception occurred', {
      code: e.code,
      message: e.msg,
      userId: e.uid,
    });

    const streamingError = ErrorMapper.mapAgoraError(e);
    this.callbacks.onError?.(streamingError);
  }

  private createParticipantFromUser(user: IAgoraRTCRemoteUser): Participant {
    return {
      id: String(user.uid),
      displayName: `User ${user.uid}`,
      isLocal: false,
      videoTracks: user.videoTrack
        ? [
            {
              id: user.videoTrack.getTrackId(),
              kind: 'video',
              enabled: true, // Remote tracks are enabled if they exist
              muted: false, // Remote tracks are not muted if they're being received
              source: 'camera',
            },
          ]
        : [],
      audioTracks: user.audioTrack
        ? [
            {
              id: user.audioTrack.getTrackId(),
              kind: 'audio',
              enabled: true, // Remote tracks are enabled if they exist
              muted: false, // Remote tracks are not muted if they're being received
              volume: user.audioTrack.getVolumeLevel() || 0,
            },
          ]
        : [],
      connectionQuality: {
        score: 100, // Default, will be updated by network quality events
        uplink: 'excellent',
        downlink: 'excellent',
        rtt: 0,
        packetLoss: 0,
      },
    };
  }

  private mapQualityToScore(quality: number): number {
    // Map Agora quality (0-6) to score (0-100)
    const qualityMap = { 0: 100, 1: 100, 2: 80, 3: 60, 4: 40, 5: 20, 6: 0 };
    return qualityMap[quality as keyof typeof qualityMap] || 0;
  }

  private mapQualityToString(quality: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (quality <= 2) return 'excellent';
    if (quality <= 3) return 'good';
    if (quality <= 4) return 'fair';
    return 'poor';
  }

  // Clean up method for proper resource management
  cleanup(): void {
    this.stopListening();
  }
}
