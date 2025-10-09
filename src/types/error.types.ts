/**
 * Streaming-specific error class
 */
export class StreamingError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'StreamingError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Error codes for streaming operations
 */
export enum ErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  DISCONNECT_FAILED = 'DISCONNECT_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  MEDIA_ACCESS_DENIED = 'MEDIA_ACCESS_DENIED',
  MEDIA_DEVICE_ERROR = 'MEDIA_DEVICE_ERROR',
  TRACK_PUBLISH_FAILED = 'TRACK_PUBLISH_FAILED',
  TRACK_UNPUBLISH_FAILED = 'TRACK_UNPUBLISH_FAILED',
  TRACK_NOT_FOUND = 'TRACK_NOT_FOUND',
  VIDEO_PLAYBACK_FAILED = 'VIDEO_PLAYBACK_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  PROVIDER_INITIALIZATION_FAILED = 'PROVIDER_INITIALIZATION_FAILED',
  PROVIDER_NOT_SUPPORTED = 'PROVIDER_NOT_SUPPORTED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  RESOURCE_UNAVAILABLE = 'RESOURCE_UNAVAILABLE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  PARTICIPANT_ERROR = 'PARTICIPANT_ERROR',
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
}

/**
 * Standardized error callback interface for all streaming components
 */
export interface ErrorCallback {
  (error: StreamingError): void;
}

/**
 * Error callback configuration for different contexts
 */
export interface ErrorCallbackConfig {
  onError?: ErrorCallback;
  onConnectionError?: ErrorCallback;
  onMediaError?: ErrorCallback;
  onNetworkError?: ErrorCallback;
  onAuthError?: ErrorCallback;
}

/**
 * Error context information for better debugging
 */
export interface ErrorContext {
  component: string;
  operation: string;
  timestamp: number;
  additionalInfo?: Record<string, unknown>;
}

/**
 * Enhanced error callback with context information
 */
export interface ContextualErrorCallback {
  (error: StreamingError, context: ErrorContext): void;
}

/**
 * Error handling configuration for components
 */
export interface ErrorHandlingConfig {
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  callbacks?: ErrorCallbackConfig;
}
