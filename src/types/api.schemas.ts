import { StreamProviderType } from './streaming.types';

// Base API response structure
export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

// Avatar system schemas
export interface Voice {
  accent: string;
  description: string;
  language: string;
  preview: string;
  voice_id: string;
  name: string;
}

export interface Language {
  lang_code: string;
  lang_name: string;
  url: string;
}

export interface Avatar {
  name: string;
  from: number;
  gender: string;
  url: string;
  avatar_id: string;
  voice_id: string;
  thumbnailUrl: string;
  available: boolean;
}

export interface Knowledge {
  _id: string;
  name: string;
}

export interface SessionOptions {
  avatar_id: string;
  duration: number;
  knowledge_id?: string;
  voice_id?: string;
  voice_url?: string;
  language?: string;
  mode_type?: number;
  background_url?: string;
  voice_params?: Record<string, unknown>;
  stream_type?: StreamProviderType;
}

export interface SessionCredentials {
  // Agora-specific
  agora_uid?: number;
  agora_app_id?: string;
  agora_channel?: string;
  agora_token?: string;

  // LiveKit-specific
  livekit_url?: string;
  livekit_token?: string;
  livekit_room_name?: string;
  livekit_client_identity?: string;
  livekit_server_identity?: string;

  // TRTC-specific
  trtc_sdk_app_id?: number;
  trtc_user_id?: string;
  trtc_user_sig?: string;
  trtc_room_id?: string;
}

export interface Session {
  _id: string;
  uid: number;
  credentials: SessionCredentials;
  stream_type: StreamProviderType;
  status: number;
}

// Messaging schemas
export interface ChatRequest {
  session_id: string;
  message: string;
  message_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  message_id: string;
  session_id: string;
  response: string;
  status: 'processing' | 'completed' | 'interrupted' | 'error';
  timestamp: number;
}

export interface InterruptRequest {
  session_id: string;
  message_id?: string;
}

// Provider configuration schemas
export interface ProviderConfig {
  type: StreamProviderType;
  enabled: boolean;
  credentials: Record<string, unknown>;
  fallback_order?: number;
}

export interface SystemConfig {
  providers: ProviderConfig[];
  default_provider: StreamProviderType;
  auto_fallback: boolean;
  session_timeout: number;
}

// Avatar parameter schemas
export interface AvatarMetadata {
  avatar_id: string;
  voice_id?: string;
  language?: string;
  background_url?: string;
  voice_params?: Record<string, unknown>;
}
