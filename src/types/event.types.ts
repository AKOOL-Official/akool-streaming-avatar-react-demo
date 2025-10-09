import { Participant, ConnectionQuality, ChatMessage, StreamProviderType } from './streaming.types';
import { StreamingError } from './error.types';

export type EventCallback<T = unknown> = (data: T) => void;

export interface StreamingEventMap {
  // Connection events
  'connection:connected': { provider: StreamProviderType };
  'connection:disconnected': { provider: StreamProviderType; reason?: string };
  'connection:failed': { provider: StreamProviderType; error: StreamingError };
  'connection:quality-changed': { quality: ConnectionQuality };

  // Participant events
  'participant:joined': { participant: Participant };
  'participant:left': { participantId: string };
  'participant:speaking-changed': { participantId: string; isSpeaking: boolean };

  // Media events
  'media:video-published': { participantId: string; trackId: string };
  'media:video-unpublished': { participantId: string; trackId: string };
  'media:audio-published': { participantId: string; trackId: string };
  'media:audio-unpublished': { participantId: string; trackId: string };

  // Communication events
  'message:received': { message: ChatMessage };
  'message:sent': { messageId: string; content: string };
  'avatar:response-interrupted': { messageId: string };

  // System events
  'system:error': { error: StreamingError };
  'system:warning': { message: string; context?: Record<string, unknown> };
  'system:info': { message: string; context?: Record<string, unknown> };
}

export type StreamingEventType = keyof StreamingEventMap;

export interface EventSubscription {
  event: StreamingEventType;
  callback: EventCallback;
  once?: boolean;
}

export interface EventBusInterface {
  subscribe<K extends StreamingEventType>(event: K, callback: EventCallback<StreamingEventMap[K]>): () => void;

  once<K extends StreamingEventType>(event: K, callback: EventCallback<StreamingEventMap[K]>): () => void;

  publish<K extends StreamingEventType>(event: K, data: StreamingEventMap[K]): void;

  clear(): void;
}
