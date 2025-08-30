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
  SYSTEM = 'system',
}

// System event types enum
export enum SystemEventType {
  AVATAR_AUDIO_START = 'avatar_audio_start',
  AVATAR_AUDIO_END = 'avatar_audio_end',
  MIC_START = 'mic_start',
  MIC_END = 'mic_end',
  CAMERA_START = 'camera_start',
  CAMERA_END = 'camera_end',
  SET_PARAMS = 'set_params',
  SET_PARAMS_ACK = 'set_params_ack',
  INTERRUPT = 'interrupt',
  INTERRUPT_ACK = 'interrupt_ack',
}

// Message sender types
export enum MessageSender {
  USER = 'user',
  AVATAR = 'avatar',
  SYSTEM = 'system',
}

// Type for user-triggered system events
export type UserTriggeredEventType =
  | SystemEventType.MIC_START
  | SystemEventType.MIC_END
  | SystemEventType.CAMERA_START
  | SystemEventType.CAMERA_END;

// UI Message interface for React components
export interface UIMessage {
  id: string;
  text: string;
  sender: MessageSender;
  messageType: MessageType;
  timestamp: number;
  // System-specific fields
  systemType?: SystemEventType;
  // Additional data for tooltips and other features
  metadata?: {
    fullParams?: Record<string, unknown>; // For set-params messages
    [key: string]: unknown;
  };
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
  createProvider(type: StreamProviderType): Promise<StreamingProvider>;
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
