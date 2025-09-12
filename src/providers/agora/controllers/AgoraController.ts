import { IAgoraRTCClient, IAgoraRTCRemoteUser, NetworkQuality } from 'agora-rtc-sdk-ng';
import { UID } from 'agora-rtc-sdk-ng/esm';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { ErrorMapper } from '../../../errors/ErrorMapper';
import { Participant, ConnectionQuality, ChatMessage } from '../../../types/streaming.types';
import { NetworkStats } from '../../../components/NetworkQuality';
import { AvatarMetadata } from '../../../types/api.schemas';
import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../../types/provider.interfaces';

// Stream message interfaces
export interface StreamMessage {
  v: number;
  type: string;
  mid?: string;
  idx?: number;
  fin?: boolean;
  pld: CommandPayload | ChatPayload | CommandResponsePayload | ChatResponsePayload;
}

export interface CommandPayload {
  cmd: string;
  data?: Record<string, unknown>;
}

export interface ChatPayload {
  text: string;
  meta?: Record<string, unknown>;
}

export interface CommandResponsePayload {
  cmd: string;
  code: number;
  msg?: string;
}

export interface ChatResponsePayload {
  text: string;
  from: 'bot' | 'user';
}

// Unified callback interface
export interface AgoraControllerCallbacks {
  // Event callbacks
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onMessageReceived?: (message: ChatMessage) => void;
  onNetworkStatsUpdate?: (stats: NetworkStats) => void;
  onError?: (error: StreamingError) => void;
  onSpeakingStateChanged?: (isSpeaking: boolean) => void;

  // Messaging callbacks
  onCommandSent?: (cmd: string, data?: Record<string, unknown>) => void;
  onCommandResponse?: (cmd: string, code: number, message?: string) => void;
  onMessageResponse?: (response: ChatResponsePayload) => void;
  onSystemMessage?: (event: SystemMessageEvent) => void;
  onChatMessage?: (event: ChatMessageEvent) => void;
  onCommand?: (event: CommandEvent) => void;
}

export class AgoraController {
  private client: IAgoraRTCClient;
  private callbacks: AgoraControllerCallbacks = {};
  private isListening = false;
  private isListeningToMessages = false;

  // Constants for message size limits
  private static readonly MAX_ENCODED_SIZE = 950;
  private static readonly BYTES_PER_SECOND = 6000;

  constructor(client: IAgoraRTCClient) {
    this.client = client;
  }

  setCallbacks(callbacks: AgoraControllerCallbacks): void {
    this.callbacks = callbacks;
    this.setupEventListeners();
    this.setupStreamMessageListener();
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

  private setupStreamMessageListener(): void {
    if (this.isListeningToMessages) return;

    this.client.on('stream-message', this.handleStreamMessage);
    this.isListeningToMessages = true;
    logger.debug('Stream message listener setup complete');
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

  private removeStreamMessageListener(): void {
    if (!this.isListeningToMessages) return;

    this.client.off('stream-message', this.handleStreamMessage);
    this.isListeningToMessages = false;
    logger.debug('Stream message listener removed');
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

  // Stream message handling methods
  private handleStreamMessage = (_: number, body: Uint8Array): void => {
    try {
      const msg = new TextDecoder().decode(body);
      const { v, type, mid, pld } = JSON.parse(msg);

      if (v !== 2) {
        logger.debug('Ignoring message with unsupported version', { version: v });
        return;
      }

      logger.debug('Processing stream message', { type, mid });

      if (type === 'chat') {
        this.handleChatMessage(mid, pld as ChatResponsePayload);
      } else if (type === 'event') {
        this.handleSystemEvent(mid, pld);
      } else if (type === 'command') {
        this.handleCommandMessage(mid, pld as CommandPayload | CommandResponsePayload);
      } else {
        logger.debug('Unknown message type received', { type, mid });
      }
    } catch (error) {
      logger.error('Error handling stream message:', { error });
    }
  };

  private handleChatMessage(messageId: string, payload: ChatResponsePayload): void {
    const { text, from } = payload;
    const event: ChatMessageEvent = {
      messageId: `chat_${messageId}`,
      text,
      from: from === 'bot' ? 'avatar' : from,
    };

    this.callbacks.onChatMessage?.(event);

    // Create legacy ChatMessage for backward compatibility
    const chatMessage: ChatMessage = {
      id: messageId || `msg-${Date.now()}`,
      content: payload.text,
      timestamp: Date.now(),
      fromParticipant: 'avatar',
      type: 'text',
    };
    this.callbacks.onMessageReceived?.(chatMessage);
  }

  private handleSystemEvent(messageId: string, payload: { event: string }): void {
    const { event } = payload;

    let eventType: SystemMessageEvent['eventType'];
    let text: string;

    switch (event) {
      case 'audio_start':
        eventType = 'avatar_audio_start';
        text = '🎤 Avatar started speaking';
        // Update speaking state
        this.callbacks.onSpeakingStateChanged?.(true);
        break;
      case 'audio_end':
        eventType = 'avatar_audio_end';
        text = '✅ Avatar finished speaking';
        // Update speaking state
        this.callbacks.onSpeakingStateChanged?.(false);
        break;
      default:
        logger.debug('Unknown system event received', { event });
        return;
    }

    const systemEvent: SystemMessageEvent = {
      messageId: `event_${messageId}`,
      text,
      eventType,
    };

    this.callbacks.onSystemMessage?.(systemEvent);
  }

  private handleCommandMessage(messageId: string, payload: CommandPayload | CommandResponsePayload): void {
    if ('code' in payload) {
      // This is a command acknowledgment
      const { cmd, code, msg } = payload;
      const success = code === 1000;
      const statusText = success ? 'Success' : 'Failed';
      const eventType = cmd === 'interrupt' ? 'interrupt_ack' : 'set_params_ack';

      const systemEvent: SystemMessageEvent = {
        messageId: `cmd_ack_${messageId}`,
        text: `${success ? '✅' : '❌'} ${cmd}: ${statusText}${msg ? ` (${msg})` : ''}`,
        eventType,
      };

      this.callbacks.onSystemMessage?.(systemEvent);

      const commandEvent: CommandEvent = {
        command: cmd,
        success,
        message: msg,
      };

      this.callbacks.onCommand?.(commandEvent);
      this.callbacks.onCommandResponse?.(cmd, code, msg);
    } else {
      // This is a command being sent
      const { cmd, data } = payload;
      const eventType = cmd === 'interrupt' ? 'interrupt' : 'set_params';
      const dataStr = data ? ` with data: ${JSON.stringify(data)}` : '';
      const messageText = cmd === 'set-params' && data ? `📤 ${cmd}${dataStr} ℹ️` : `📤 ${cmd}${dataStr}`;

      const metadata = cmd === 'set-params' && data ? { fullParams: data } : undefined;

      const systemEvent: SystemMessageEvent = {
        messageId: `cmd_send_${messageId}`,
        text: messageText,
        eventType,
        metadata,
      };

      this.callbacks.onSystemMessage?.(systemEvent);

      const commandEvent: CommandEvent = {
        command: cmd,
        data,
      };

      this.callbacks.onCommand?.(commandEvent);
      this.callbacks.onCommandSent?.(cmd, data);
    }
  }

  // Messaging methods
  async setAvatarParameters(metadata: AvatarMetadata): Promise<void> {
    try {
      logger.info('Setting avatar parameters', { metadata });

      if (!this.isClientReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Client not ready for sending messages', {
          details: { connectionState: this.client.connectionState, uid: this.client.uid },
        });
      }

      const cleanedMeta = Object.fromEntries(
        Object.entries(metadata).filter(([_, value]) => value !== undefined && value !== null && value !== ''),
      );

      const message: StreamMessage = {
        v: 2,
        type: 'command',
        mid: `msg-${Date.now()}`,
        pld: {
          cmd: 'set-params',
          data: cleanedMeta,
        },
      };

      const jsonData = JSON.stringify(message);
      logger.debug('Sending avatar parameters', {
        messageSize: jsonData.length,
        cleanedParameters: cleanedMeta,
      });

      await (
        this.client as unknown as { sendStreamMessage: (data: string, reliable: boolean) => Promise<void> }
      ).sendStreamMessage(jsonData, false);

      // Trigger both onCommandSent and onCommand callbacks
      this.callbacks.onCommandSent?.('set-params', cleanedMeta);

      const commandEvent: CommandEvent = {
        command: 'set-params',
        data: cleanedMeta,
      };
      this.callbacks.onCommand?.(commandEvent);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to set avatar parameters', {
        error: streamingError.message,
        metadata,
      });
      throw streamingError;
    }
  }

  async interruptResponse(): Promise<void> {
    try {
      logger.info('Sending interrupt command');

      if (!this.isClientReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Client not ready for sending messages', {
          details: { connectionState: this.client.connectionState, uid: this.client.uid },
        });
      }

      const message: StreamMessage = {
        v: 2,
        type: 'command',
        mid: `msg-${Date.now()}`,
        pld: {
          cmd: 'interrupt',
        },
      };

      const jsonData = JSON.stringify(message);
      logger.debug('Sending interrupt command', { messageSize: jsonData.length });

      await (
        this.client as unknown as { sendStreamMessage: (data: string, reliable: boolean) => Promise<void> }
      ).sendStreamMessage(jsonData, false);

      // Trigger both onCommandSent and onCommand callbacks
      this.callbacks.onCommandSent?.('interrupt');

      const commandEvent: CommandEvent = {
        command: 'interrupt',
      };
      this.callbacks.onCommand?.(commandEvent);
    } catch (error) {
      const streamingError = ErrorMapper.mapAgoraError(error);
      logger.error('Failed to send interrupt command', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async sendMessage(messageId: string, content: string): Promise<void> {
    try {
      logger.info('Sending message to avatar', { messageId, contentLength: content.length });

      if (!this.isClientReady()) {
        throw new StreamingError(ErrorCode.CONNECTION_FAILED, 'Client not ready for sending messages', {
          details: { connectionState: this.client.connectionState, uid: this.client.uid },
        });
      }

      if (!content) {
        throw new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Message content cannot be empty');
      }

      const chunks = this.splitMessageIntoChunks(content, messageId);
      logger.debug('Message split into chunks', {
        totalChunks: chunks.length,
        messageId,
      });

      await this.sendMessageChunks(chunks, messageId);
    } catch (error) {
      const streamingError = error instanceof StreamingError ? error : ErrorMapper.mapAgoraError(error);

      logger.error('Failed to send message', {
        error: streamingError.message,
        messageId,
        contentLength: content.length,
      });
      throw streamingError;
    }
  }

  private splitMessageIntoChunks(content: string, messageId: string): string[] {
    const baseEncoded = this.encodeMessage('', 0, false, messageId);
    const maxQuestionLength = Math.floor((AgoraController.MAX_ENCODED_SIZE - baseEncoded.length) / 4);

    const chunks: string[] = [];
    let remainingMessage = content;
    let chunkIndex = 0;

    while (remainingMessage.length > 0) {
      let chunk = remainingMessage.slice(0, maxQuestionLength);
      let encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);

      while (encoded.length > AgoraController.MAX_ENCODED_SIZE && chunk.length > 1) {
        chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
        encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);
      }

      if (encoded.length > AgoraController.MAX_ENCODED_SIZE) {
        throw new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Message content too large for chunking', {
          details: { chunkSize: encoded.length, maxSize: AgoraController.MAX_ENCODED_SIZE },
        });
      }

      chunks.push(chunk);
      remainingMessage = remainingMessage.slice(chunk.length);
      chunkIndex++;
    }

    return chunks;
  }

  private async sendMessageChunks(chunks: string[], messageId: string): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;
      const encodedChunk = this.encodeMessage(chunks[i], i, isLastChunk, messageId);
      const chunkSize = encodedChunk.length;

      const minimumTimeMs = Math.ceil((1000 * chunkSize) / AgoraController.BYTES_PER_SECOND);
      const startTime = Date.now();

      logger.debug('Sending message chunk', {
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        chunkSize,
        isLastChunk,
        messageId,
      });

      try {
        await (
          this.client as unknown as { sendStreamMessage: (data: Uint8Array, reliable: boolean) => Promise<void> }
        ).sendStreamMessage(encodedChunk, false);
      } catch (error) {
        throw new StreamingError(ErrorCode.API_REQUEST_FAILED, `Failed to send chunk ${i + 1}/${chunks.length}`, {
          details: { chunkIndex: i, messageId, originalError: error },
        });
      }

      if (!isLastChunk) {
        const elapsedMs = Date.now() - startTime;
        const remainingDelay = Math.max(0, minimumTimeMs - elapsedMs);
        if (remainingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        }
      }
    }
  }

  private encodeMessage(text: string, idx: number, fin: boolean, messageId: string): Uint8Array {
    const message: StreamMessage = {
      v: 2,
      type: 'chat',
      mid: messageId,
      idx,
      fin,
      pld: {
        text,
      },
    };
    return new TextEncoder().encode(JSON.stringify(message));
  }

  private isClientReady(): boolean {
    return this.client.connectionState === 'CONNECTED' && this.client.uid !== undefined;
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
    this.removeStreamMessageListener();
    this.callbacks = {};
  }
}
