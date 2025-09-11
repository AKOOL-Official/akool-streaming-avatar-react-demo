import { StreamProviderType } from './streaming.types';

// Base API response structure
export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

// Avatar system schemas
export interface Avatar {
  avatar_id: string;
  name: string;
  gender: string;
  url: string;
  thumbnailUrl: string;
  voice_id: string;
  from: number;
  available: boolean;
}

export interface Voice {
  voice_id: string;
  name: string;
  accent: string;
  description: string;
  language: string;
  preview: string;
}

export interface Language {
  lang_code: string;
  lang_name: string;
  url: string;
}

export interface Knowledge {
  _id: string;
  name: string;
}

// Session management schemas
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
  provider?: StreamProviderType;
}

export interface SessionCredentials {
  // Common credentials
  channel: string;
  userId: string;

  // Agora-specific
  agora_uid?: number;
  agora_app_id?: string;
  agora_channel?: string;
  agora_token?: string;

  // LiveKit-specific
  livekit_url?: string;
  livekit_token?: string;

  // TRTC-specific
  trtc_sdk_app_id?: number;
  trtc_user_id?: string;
  trtc_user_sig?: string;
  trtc_room_id?: string;
}

export interface Session {
  _id: string;
  credentials: SessionCredentials;
  provider: StreamProviderType;
  status: 'active' | 'inactive' | 'closed';
  created_at: number;
  expires_at: number;

  // @deprecated - for backward compatibility
  stream_urls?: SessionCredentials;
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
  voice_params?: {
    pitch?: number;
    speed?: number;
    volume?: number;
    [key: string]: unknown;
  };
}

// API request/response schemas for various endpoints
export interface CreateSessionRequest {
  options: SessionOptions;
  provider_preference?: StreamProviderType;
}

export interface CreateSessionResponse {
  session: Session;
  connection_info: {
    provider: StreamProviderType;
    credentials: SessionCredentials;
    endpoints?: string[];
  };
}

export interface CloseSessionRequest {
  session_id: string;
}

export interface CloseSessionResponse {
  session_id: string;
  status: 'closed';
  timestamp: number;
}

// List response schemas
export interface AvatarListResponse {
  result: Avatar[];
  total: number;
  page: number;
  size: number;
}

export interface VoiceListResponse {
  voices: Voice[];
  total: number;
}

export interface LanguageListResponse {
  lang_list: Language[];
}

export interface KnowledgeListResponse {
  knowledge_list: Knowledge[];
  total: number;
}

// Error response schemas
export interface ApiError {
  code: number;
  message: string;
  details?: Record<string, unknown>;
  provider?: StreamProviderType;
  timestamp: number;
}

// Health check schemas
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: {
    [K in StreamProviderType]: {
      status: 'available' | 'unavailable';
      latency?: number;
      error?: string;
    };
  };
  timestamp: number;
}
