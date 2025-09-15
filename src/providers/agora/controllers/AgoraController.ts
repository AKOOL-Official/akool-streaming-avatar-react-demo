import { IAgoraRTCClient, IAgoraRTCRemoteUser, NetworkQuality } from 'agora-rtc-sdk-ng';
import { UID } from 'agora-rtc-sdk-ng/esm';
import { logger } from '../../../core/Logger';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { Participant, ConnectionQuality } from '../../../types/streaming.types';
import { NetworkStats } from '../../../components/NetworkQuality';
import { AvatarMetadata } from '../../../types/api.schemas';
import { CommonMessageController } from '../../common/CommonMessageController';
import { AgoraMessageAdapter } from '../adapters/AgoraMessageAdapter';
import { MessageProviderConfig } from '../../common/types/message.types';

// Unified callback interface
export interface AgoraControllerCallbacks {
  // Event callbacks
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
  onError?: (error: Error) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;

  // Messaging callbacks (delegated to CommonMessageController)
  onCommandSent?: (cmd: string, data?: Record<string, unknown>) => void;
  onCommandResponse?: (cmd: string, code: number, message?: string) => void;
  onMessageResponse?: (response: { text: string; from: 'bot' | 'user' }) => void;
  onSystemMessage?: (event: unknown) => void;
  onChatMessage?: (event: unknown) => void;
  onCommand?: (event: unknown) => void;
  onMessageReceived?: (message: unknown) => void;
}

export class AgoraController {
  private client: IAgoraRTCClient;
  private callbacks: AgoraControllerCallbacks = {};
  private isListening = false;
  private messageController: CommonMessageController;

  // Agora-specific configuration
  private static readonly AGORA_CONFIG: MessageProviderConfig = {
    maxEncodedSize: 950,
    bytesPerSecond: 6000,
  };

  constructor(client: IAgoraRTCClient) {
    this.client = client;
    const messageAdapter = new AgoraMessageAdapter(client);
    this.messageController = new CommonMessageController(messageAdapter, AgoraController.AGORA_CONFIG);
  }

  setCallbacks(callbacks: AgoraControllerCallbacks): void {
    this.callbacks = callbacks;
    this.setupEventListeners();

    // Delegate message callbacks to CommonMessageController
    this.messageController.setCallbacks({
      onParticipantJoined: callbacks.onParticipantJoined
        ? (participant) => callbacks.onParticipantJoined?.(participant as Participant)
        : undefined,
      onParticipantLeft: callbacks.onParticipantLeft,
      onConnectionQualityChanged: callbacks.onConnectionQualityChanged
        ? (quality) => callbacks.onConnectionQualityChanged?.(quality as ConnectionQuality)
        : undefined,
      onMessageReceived: callbacks.onMessageReceived,
      onError: callbacks.onError,
      onSpeakingStateChanged: callbacks.onSpeakingStateChanged,
      onCommandSent: callbacks.onCommandSent,
      onCommandResponse: callbacks.onCommandResponse,
      onMessageResponse: callbacks.onMessageResponse,
      onSystemMessage: callbacks.onSystemMessage,
      onChatMessage: callbacks.onChatMessage,
      onCommand: callbacks.onCommand,
    });
  }

  private setupEventListeners(): void {
    if (this.isListening) return;

    // User media events
    this.client.on('user-published', this.handleUserPublished.bind(this));
    this.client.on('user-unpublished', this.handleUserUnpublished.bind(this));
    this.client.on('user-joined', this.handleUserJoined.bind(this));
    this.client.on('user-left', this.handleUserLeft.bind(this));

    // Network quality events
    this.client.on('network-quality', this.handleNetworkQuality.bind(this));

    // Exception handling
    this.client.on('exception', this.handleException.bind(this));

    this.isListening = true;
    logger.info('Started listening to Agora events');
  }

  private removeEventListeners(): void {
    if (!this.isListening) return;

    this.client.removeAllListeners('user-published');
    this.client.removeAllListeners('user-unpublished');
    this.client.removeAllListeners('user-joined');
    this.client.removeAllListeners('user-left');
    this.client.removeAllListeners('network-quality');
    this.client.removeAllListeners('exception');

    this.isListening = false;
    logger.info('Stopped listening to Agora events');
  }

  // Event handling methods
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
        remoteTrack.play('remote-video', { fit: 'contain' });

        logger.debug('Subscribed to remote video track', {
          userId: user.uid,
          trackId: remoteTrack.getTrackId(),
        });
      } else if (mediaType === 'audio') {
        const remoteTrack = await this.client.subscribe(user, mediaType);
        remoteTrack.play();

        logger.debug('Subscribed to remote audio track', {
          userId: user.uid,
          trackId: remoteTrack.getTrackId(),
        });
      }

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

      const participant = this.createParticipantFromUser(user);
      this.callbacks.onParticipantJoined?.(participant);
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
      const videoStats = this.client.getRemoteVideoStats();
      const audioStats = this.client.getRemoteAudioStats();

      const firstVideoStats = Object.values(videoStats)[0] || {};
      const firstAudioStats = Object.values(audioStats)[0] || {};

      // Calculate RTT from video/audio stats (end2EndDelay is the most accurate RTT measurement)
      const videoRtt = firstVideoStats.end2EndDelay || 0;
      const audioRtt = firstAudioStats.end2EndDelay || 0;
      const avgRtt = videoRtt > 0 && audioRtt > 0 ? (videoRtt + audioRtt) / 2 : Math.max(videoRtt, audioRtt);

      const connectionQuality: ConnectionQuality = {
        score: this.mapQualityToScore(stats.downlinkNetworkQuality || 0),
        uplink: this.mapQualityToString(stats.uplinkNetworkQuality || 0),
        downlink: this.mapQualityToString(stats.downlinkNetworkQuality || 0),
        rtt: avgRtt,
        packetLoss: ((firstVideoStats.packetLossRate || 0) + (firstAudioStats.packetLossRate || 0)) / 2,
      };

      const networkStatsUpdate: NetworkStats = {
        connectionQuality: connectionQuality,
        detailedStats: {
          video: {
            codec: firstVideoStats.codecType,
            bitrate: firstVideoStats.receiveBitrate,
            frameRate: firstVideoStats.receiveFrameRate,
            resolution: {
              width: firstVideoStats.receiveResolutionWidth,
              height: firstVideoStats.receiveResolutionHeight,
            },
            packetLoss: firstVideoStats.packetLossRate,
            rtt: firstVideoStats.end2EndDelay,
          },
          audio: {
            codec: firstAudioStats.codecType,
            bitrate: firstAudioStats.receiveBitrate,
            packetLoss: firstAudioStats.packetLossRate,
            volume: firstAudioStats.receiveLevel,
            rtt: firstAudioStats.end2EndDelay,
          },
        },
      };

      this.callbacks.onNetworkStatsUpdate?.(networkStatsUpdate);
      this.callbacks.onConnectionQualityChanged?.(connectionQuality);
    } catch (error) {
      logger.warn('Failed to process network quality stats', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

  // Message handling is now delegated to CommonMessageController

  // Messaging methods - delegated to CommonMessageController
  async setAvatarParameters(metadata: AvatarMetadata): Promise<void> {
    return this.messageController.setAvatarParameters(metadata as unknown as Record<string, unknown>);
  }

  async interruptResponse(): Promise<void> {
    return this.messageController.interruptResponse();
  }

  async sendMessage(messageId: string, content: string): Promise<void> {
    return this.messageController.sendMessage(messageId, content);
  }

  // Utility methods
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
              enabled: true,
              muted: false,
              source: 'camera',
            },
          ]
        : [],
      audioTracks: user.audioTrack
        ? [
            {
              id: user.audioTrack.getTrackId(),
              kind: 'audio',
              enabled: true,
              muted: false,
              volume: user.audioTrack.getVolumeLevel() || 0,
            },
          ]
        : [],
      connectionQuality: {
        score: 100,
        uplink: 'excellent',
        downlink: 'excellent',
        rtt: 0,
        packetLoss: 0,
      },
    };
  }

  private mapQualityToScore(quality: number): number {
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
    this.removeEventListeners();
    this.messageController.cleanup();
    this.callbacks = {};
  }
}
