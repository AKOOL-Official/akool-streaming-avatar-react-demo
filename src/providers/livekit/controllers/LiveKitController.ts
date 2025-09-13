import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  RemoteAudioTrack,
  RemoteTrackPublication,
} from 'livekit-client';
import { logger } from '../../../core/Logger';
import { StreamingError, ErrorCode } from '../../../types/error.types';
import { Participant, ConnectionQuality, ChatMessage } from '../../../types/streaming.types';
import { SystemMessageEvent, ChatMessageEvent, CommandEvent } from '../../../types/provider.interfaces';

// Stream message interfaces (matching Agora pattern)
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
export interface LiveKitControllerCallbacks {
  // Event callbacks
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onConnectionQualityChanged?: (quality: ConnectionQuality) => void;
  onMessageReceived?: (message: ChatMessage) => void;
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

export class LiveKitController {
  private room: Room;
  private callbacks: LiveKitControllerCallbacks = {};
  private isListening = false;
  private isListeningToMessages = false;

  // Constants for message size limits (matching Agora implementation)
  private static readonly MAX_ENCODED_SIZE = 950;
  private static readonly BYTES_PER_SECOND = 6000;

  constructor(room: Room) {
    this.room = room;
  }

  setCallbacks(callbacks: LiveKitControllerCallbacks): void {
    this.callbacks = callbacks;
    this.setupEventListeners();
    this.setupDataListener();
  }

  private setupEventListeners(): void {
    if (this.isListening) return;

    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected.bind(this));
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected.bind(this));

    // Track events
    this.room.on(RoomEvent.TrackPublished, this.handleTrackPublished.bind(this));
    this.room.on(RoomEvent.TrackUnpublished, this.handleTrackUnpublished.bind(this));

    // Connection quality events - temporarily disabled due to signature mismatch
    // this.room.on(RoomEvent.ConnectionQualityChanged, this.handleConnectionQualityChanged.bind(this));

    // Speaking events - temporarily disabled due to signature mismatch
    // this.room.on(RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakersChanged.bind(this));

    this.isListening = true;
    logger.info('Started listening to LiveKit events');
  }

  private setupDataListener(): void {
    if (this.isListeningToMessages) return;

    this.room.on(RoomEvent.DataReceived, this.handleDataReceived.bind(this));
    this.isListeningToMessages = true;
    logger.info('Started listening to LiveKit data messages');
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
    }
  }

  private handleTrackPublished(publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    logger.debug('LiveKit track published', {
      trackSid: publication.trackSid,
      kind: publication.kind,
      participant: participant.identity,
    });

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
      }
    }
  }

  private handleTrackUnpublished(): void {
    // Track unpublication handling can be delegated to specific controllers
    logger.debug('LiveKit track unpublished');
  }

  // Connection quality and speaking events temporarily disabled
  // Will be re-enabled when proper event signatures are determined

  // private handleConnectionQualityChanged(quality: LKConnectionQuality, participant: LocalParticipant | RemoteParticipant): void {
  //   try {
  //     const unifiedQuality = this.convertConnectionQuality(quality);
  //     logger.debug('LiveKit connection quality changed', { quality: unifiedQuality, participant: participant.identity });
  //     this.callbacks.onConnectionQualityChanged?.(unifiedQuality);
  //   } catch (error) {
  //     logger.error('Error handling connection quality change', { error: error instanceof Error ? error.message : String(error) });
  //   }
  // }

  // private handleActiveSpeakersChanged(speakers: (LocalParticipant | RemoteParticipant)[]): void {
  //   try {
  //     const isSpeaking = speakers.length > 0;
  //     logger.debug('LiveKit active speakers changed', { speakerCount: speakers.length, isSpeaking });
  //     this.callbacks.onSpeakingStateChanged?.(isSpeaking);
  //   } catch (error) {
  //     logger.error('Error handling active speakers change', { error: error instanceof Error ? error.message : String(error) });
  //   }
  // }

  private handleDataReceived(payload: Uint8Array, participant?: RemoteParticipant): void {
    try {
      const text = new TextDecoder().decode(payload);
      logger.debug('LiveKit data received', {
        length: payload.length,
        from: participant?.identity,
        text: text.substring(0, 100), // Log first 100 chars for debugging
      });

      // Try to parse as stream message
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        logger.debug('Parsed JSON data', { data });
        this.processStreamMessage(data, participant);
      } catch (parseError) {
        logger.warn('Failed to parse JSON, treating as simple text message', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          text: text.substring(0, 100),
        });

        // If not JSON, treat as simple text message
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          content: text,
          timestamp: Date.now(),
          fromParticipant: participant?.identity || 'system',
          type: 'text',
        };
        this.callbacks.onMessageReceived?.(message);
      }
    } catch (error) {
      logger.error('Error handling data received', {
        error: error instanceof Error ? error.message : String(error),
        payloadLength: payload.length,
      });
    }
  }

  private processStreamMessage(data: Record<string, unknown>, _participant?: RemoteParticipant): void {
    try {
      // Validate message format (matching Agora pattern)
      const streamMessage = data as unknown as StreamMessage;
      const { v, type, mid, pld } = streamMessage;

      if (v !== 2) {
        logger.debug('Ignoring message with unsupported version', { version: v });
        return;
      }

      logger.debug('Processing stream message', { type, mid });

      switch (type) {
        case 'chat':
          this.handleChatMessage(mid || `msg-${Date.now()}`, pld as ChatResponsePayload);
          break;
        case 'event':
          this.handleSystemEvent(mid || `event-${Date.now()}`, pld as unknown as { event: string });
          break;
        case 'command':
          this.handleCommandMessage(mid || `cmd-${Date.now()}`, pld as CommandPayload | CommandResponsePayload);
          break;
        default:
          logger.debug('Unknown message type received', { type, mid });
      }
    } catch (error) {
      logger.error('Error processing stream message', {
        error: error instanceof Error ? error.message : String(error),
        data,
      });
    }
  }

  private handleChatMessage(messageId: string, payload: ChatResponsePayload, _participant?: RemoteParticipant): void {
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

  async sendMessage(messageId: string, content: string): Promise<void> {
    try {
      logger.info('Sending message to avatar', { messageId, contentLength: content.length });

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
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(
              ErrorCode.API_REQUEST_FAILED,
              `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
            );

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
    const maxQuestionLength = Math.floor((LiveKitController.MAX_ENCODED_SIZE - baseEncoded.length) / 4);

    const chunks: string[] = [];
    let remainingMessage = content;
    let chunkIndex = 0;

    while (remainingMessage.length > 0) {
      let chunk = remainingMessage.slice(0, maxQuestionLength);
      let encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);

      while (encoded.length > LiveKitController.MAX_ENCODED_SIZE && chunk.length > 1) {
        chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
        encoded = this.encodeMessage(chunk, chunkIndex, false, messageId);
      }

      if (encoded.length > LiveKitController.MAX_ENCODED_SIZE) {
        throw new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Message content too large for chunking', {
          details: { chunkSize: encoded.length, maxSize: LiveKitController.MAX_ENCODED_SIZE },
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

      const minimumTimeMs = Math.ceil((1000 * chunkSize) / LiveKitController.BYTES_PER_SECOND);
      const startTime = Date.now();

      logger.debug('Sending message chunk', {
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        chunkSize,
        isLastChunk,
        messageId,
      });

      try {
        await this.room.localParticipant.publishData(encodedChunk, { reliable: true });
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

  async interruptResponse(): Promise<void> {
    try {
      logger.info('Sending interrupt command');

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

      const encoder = new TextEncoder();
      const data = encoder.encode(jsonData);

      await this.room.localParticipant.publishData(data, { reliable: true });

      // Trigger both onCommandSent and onCommand callbacks
      this.callbacks.onCommandSent?.('interrupt');

      const commandEvent: CommandEvent = {
        command: 'interrupt',
      };
      this.callbacks.onCommand?.(commandEvent);
    } catch (error) {
      const streamingError = new StreamingError(
        ErrorCode.API_REQUEST_FAILED,
        `Failed to send interrupt: ${error instanceof Error ? error.message : String(error)}`,
      );

      logger.error('Failed to send interrupt command', {
        error: streamingError.message,
      });
      throw streamingError;
    }
  }

  async setAvatarParameters(metadata: Record<string, unknown>): Promise<void> {
    try {
      logger.info('Setting avatar parameters', { metadata });

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

      const encoder = new TextEncoder();
      const data = encoder.encode(jsonData);

      await this.room.localParticipant.publishData(data, { reliable: true });

      // Trigger both onCommandSent and onCommand callbacks
      this.callbacks.onCommandSent?.('set-params', cleanedMeta);

      const commandEvent: CommandEvent = {
        command: 'set-params',
        data: cleanedMeta,
      };
      this.callbacks.onCommand?.(commandEvent);
    } catch (error) {
      const streamingError = new StreamingError(
        ErrorCode.API_REQUEST_FAILED,
        `Failed to set avatar parameters: ${error instanceof Error ? error.message : String(error)}`,
      );

      logger.error('Failed to set avatar parameters', {
        error: streamingError.message,
        metadata,
      });
      throw streamingError;
    }
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

  // private convertConnectionQuality(quality: LKConnectionQuality): ConnectionQuality {
  //   switch (quality) {
  //     case LKConnectionQuality.Excellent:
  //       return { score: 100, uplink: 'excellent', downlink: 'excellent', rtt: 30, packetLoss: 0 };
  //     case LKConnectionQuality.Good:
  //       return { score: 75, uplink: 'good', downlink: 'good', rtt: 60, packetLoss: 1 };
  //     case LKConnectionQuality.Poor:
  //       return { score: 50, uplink: 'fair', downlink: 'fair', rtt: 150, packetLoss: 5 };
  //     case LKConnectionQuality.Lost:
  //       return { score: 0, uplink: 'poor', downlink: 'poor', rtt: 500, packetLoss: 20 };
  //     default:
  //       return { score: 0, uplink: 'poor', downlink: 'poor', rtt: 0, packetLoss: 0 };
  //   }
  // }

  cleanup(): void {
    logger.debug('Cleaning up LiveKit controller');

    // Remove all event listeners
    this.room.removeAllListeners(RoomEvent.ParticipantConnected);
    this.room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    this.room.removeAllListeners(RoomEvent.TrackPublished);
    this.room.removeAllListeners(RoomEvent.TrackUnpublished);
    // this.room.removeAllListeners(RoomEvent.ConnectionQualityChanged);
    // this.room.removeAllListeners(RoomEvent.ActiveSpeakersChanged);
    this.room.removeAllListeners(RoomEvent.DataReceived);

    this.isListening = false;
    this.isListeningToMessages = false;
    this.callbacks = {};

    logger.info('LiveKit controller cleanup completed');
  }
}
