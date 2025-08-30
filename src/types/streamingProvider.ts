import { ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { LocalVideoTrack as LiveKitVideoTrack } from 'livekit-client';
import { NetworkStats } from '../components/NetworkQuality';
import { Credentials } from '../apiService';

export type StreamProviderType = 'agora' | 'livekit' | 'trtc';

// Common video track type that can be either Agora or LiveKit
export type VideoTrack = ILocalVideoTrack | LiveKitVideoTrack;

// Participant info structure
export interface ParticipantInfo {
  uid: string | number;
  identity: string;
  name?: string;
}

// Network quality information
export interface NetworkQuality {
  uplinkQuality: number;
  downlinkQuality: number;
}

// Streaming state that all providers should maintain
export interface StreamingState {
  isJoined: boolean;
  connected: boolean;
  remoteStats: NetworkStats | null;
  participants: ParticipantInfo[];
  networkQuality: NetworkQuality | null;
}

// Command and message types (common across providers)
export interface Metadata {
  vid?: string; // voice id
  vurl?: string; // voice url
  lang?: string; // language
  mode?: number; // mode
  bgurl?: string; // background url
  vparams?: Record<string, unknown>; // voice params
}

export enum CommandType {
  SET_PARAMS = 'set-params',
  INTERRUPT = 'interrupt',
  SET_ACTION = 'set-action',
}

export interface CommandPayload {
  cmd: CommandType;
  data?: Metadata;
}

export type CommandResponsePayload = {
  cmd: CommandType;
  code: number;
  msg?: string;
};

export interface ChatPayload {
  text: string;
  meta?: Metadata;
  from?: 'bot' | 'user';
}

export interface EventPayload {
  event: string;
  data?: Record<string, unknown>;
}

export type ChatResponsePayload = {
  text: string;
  from: 'bot' | 'user';
};

export enum MessageType {
  COMMAND = 'command',
  CHAT = 'chat',
  EVENT = 'event',
}

export interface StreamMessage {
  v: number;
  type: MessageType;
  mid: string;
  idx?: number;
  fin?: boolean;
  pld: CommandPayload | ChatPayload | EventPayload;
}

// Event handlers
export interface StreamingEventHandlers {
  onUserJoin?: (participant: ParticipantInfo) => void;
  onUserLeave?: (participant: ParticipantInfo) => void;
  onNetworkQuality?: (quality: NetworkQuality) => void;
  onStreamMessage?: (
    message: string,
    from: ParticipantInfo,
    messageData?: ChatResponsePayload,
    messageId?: string,
  ) => void;
  onSystemMessage?: (messageId: string, text: string, systemType: string, metadata?: Record<string, unknown>) => void;
  onAudioStateChange?: (isSpeaking: boolean) => void;
  onException?: (error: { code: number; msg: string; uid?: string | number }) => void;
  onTokenExpired?: () => void;
}

// Main streaming provider interface
export interface StreamingProvider {
  readonly providerType: StreamProviderType;
  readonly state: StreamingState;

  // Connection management
  connect(credentials: Credentials, handlers?: StreamingEventHandlers): Promise<void>;
  disconnect(): Promise<void>;

  // Media management
  publishVideo(track: VideoTrack): Promise<void>;
  unpublishVideo(): Promise<void>;
  subscribeToRemoteVideo(containerId: string): Promise<void>;
  unsubscribeFromRemoteVideo(): Promise<void>;

  // Messaging
  sendMessage(messageId: string, content: string): Promise<void>;
  sendCommand(
    command: CommandPayload,
    onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void,
  ): Promise<void>;
  interruptResponse(onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void): Promise<void>;
  setAvatarParams(meta: Metadata, onCommandSend?: (cmd: string, data?: Record<string, unknown>) => void): Promise<void>;

  // State queries
  isConnected(): boolean;
  isJoined(): boolean;
  canSendMessages(): boolean;

  // Cleanup
  cleanup(): Promise<void>;
}

// Provider factory interface
export interface StreamingProviderFactory {
  createProvider(type: StreamProviderType): StreamingProvider;
  getSupportedProviders(): StreamProviderType[];
}

// Configuration for different providers
export interface ProviderConfig {
  agora?: {
    logLevel?: number;
    codec?: 'vp8' | 'vp9' | 'h264';
    mode?: 'rtc' | 'live';
  };
  livekit?: {
    adaptiveStream?: boolean;
    dynacast?: boolean;
    websocketTimeout?: number;
  };
  trtc?: {
    // TRTC specific configuration
  };
}
