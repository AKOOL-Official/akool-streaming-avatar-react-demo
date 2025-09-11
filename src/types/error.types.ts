import { StreamProviderType } from './streaming.types';

export enum ErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Media errors
  MEDIA_DEVICE_ERROR = 'MEDIA_DEVICE_ERROR',
  TRACK_PUBLISH_FAILED = 'TRACK_PUBLISH_FAILED',
  TRACK_UNPUBLISH_FAILED = 'TRACK_UNPUBLISH_FAILED',

  // API errors
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',

  // Provider errors
  PROVIDER_NOT_SUPPORTED = 'PROVIDER_NOT_SUPPORTED',
  PROVIDER_INITIALIZATION_FAILED = 'PROVIDER_INITIALIZATION_FAILED',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorContext {
  provider?: StreamProviderType;
  action?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export class StreamingError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;
  public readonly recoverable: boolean;

  constructor(code: ErrorCode, message: string, context: Partial<ErrorContext> = {}, recoverable = true) {
    super(message);
    this.name = 'StreamingError';
    this.code = code;
    this.context = {
      timestamp: Date.now(),
      ...context,
    };
    this.recoverable = recoverable;
  }
}
