import { StreamingError, ErrorCode } from '../types/error.types';
import { StreamProviderType } from '../types/streaming.types';

// Helper function to safely convert unknown to Record<string, unknown>
function toErrorDetails(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return { value };
}

export class ErrorMapper {
  static mapAgoraError(agoraError: unknown): StreamingError {
    const error = agoraError as { code?: string; name?: string; message?: string };
    const errorCode = error?.code || error?.name;

    switch (errorCode) {
      case 'INVALID_PARAMS':
      case 'INVALID_APP_ID':
        return new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Invalid Agora credentials provided', {
          provider: 'agora',
          details: toErrorDetails(agoraError),
        });

      case 'NETWORK_ERROR':
      case 'NETWORK_TIMEOUT':
        return new StreamingError(ErrorCode.CONNECTION_FAILED, 'Network connection failed', {
          provider: 'agora',
          details: toErrorDetails(agoraError),
        });

      case 'CONNECTION_STATE_CHANGED':
        return new StreamingError(ErrorCode.CONNECTION_LOST, 'Connection state changed unexpectedly', {
          provider: 'agora',
          details: toErrorDetails(agoraError),
        });

      case 'MEDIA_NOT_SUPPORT':
      case 'DEVICE_NOT_FOUND':
        return new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Media device error', {
          provider: 'agora',
          details: toErrorDetails(agoraError),
        });

      case 'PUBLISH_STREAM_FAILED':
        return new StreamingError(ErrorCode.TRACK_PUBLISH_FAILED, 'Failed to publish media track', {
          provider: 'agora',
          details: toErrorDetails(agoraError),
        });

      case 'UNPUBLISH_STREAM_FAILED':
        return new StreamingError(ErrorCode.TRACK_UNPUBLISH_FAILED, 'Failed to unpublish media track', {
          provider: 'agora',
          details: toErrorDetails(agoraError),
        });

      default:
        return new StreamingError(ErrorCode.UNKNOWN_ERROR, error?.message || 'Unknown Agora error', {
          provider: 'agora',
          details: toErrorDetails(agoraError),
        });
    }
  }

  static mapLiveKitError(liveKitError: unknown): StreamingError {
    const error = liveKitError as { code?: string; name?: string; message?: string };
    const errorCode = error?.code || error?.name;

    switch (errorCode) {
      case 'ConnectionError':
        return new StreamingError(ErrorCode.CONNECTION_FAILED, 'Failed to connect to LiveKit server', {
          provider: 'livekit',
          details: toErrorDetails(liveKitError),
        });

      case 'Disconnected':
        return new StreamingError(ErrorCode.CONNECTION_LOST, 'Connection to LiveKit server lost', {
          provider: 'livekit',
          details: toErrorDetails(liveKitError),
        });

      case 'InvalidToken':
        return new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Invalid LiveKit token', {
          provider: 'livekit',
          details: toErrorDetails(liveKitError),
        });

      case 'MediaDeviceFailure':
        return new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'Media device failure', {
          provider: 'livekit',
          details: toErrorDetails(liveKitError),
        });

      case 'PublishError':
        return new StreamingError(ErrorCode.TRACK_PUBLISH_FAILED, 'Failed to publish track to LiveKit', {
          provider: 'livekit',
          details: toErrorDetails(liveKitError),
        });

      case 'UnpublishError':
        return new StreamingError(ErrorCode.TRACK_UNPUBLISH_FAILED, 'Failed to unpublish track from LiveKit', {
          provider: 'livekit',
          details: toErrorDetails(liveKitError),
        });

      default:
        return new StreamingError(ErrorCode.UNKNOWN_ERROR, error?.message || 'Unknown LiveKit error', {
          provider: 'livekit',
          details: toErrorDetails(liveKitError),
        });
    }
  }

  static mapTRTCError(trtcError: unknown): StreamingError {
    const error = trtcError as { code?: string; name?: string; message?: string };
    const errorCode = error?.code || error?.name;

    switch (errorCode) {
      case 'InvalidParameter':
      case 'InvalidSdkAppId':
        return new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Invalid TRTC credentials or parameters', {
          provider: 'trtc',
          details: toErrorDetails(trtcError),
        });

      case 'NetworkUnavailable':
      case 'ConnectFailed':
        return new StreamingError(ErrorCode.CONNECTION_FAILED, 'Failed to connect to TRTC server', {
          provider: 'trtc',
          details: toErrorDetails(trtcError),
        });

      case 'Disconnected':
        return new StreamingError(ErrorCode.CONNECTION_LOST, 'Connection to TRTC server lost', {
          provider: 'trtc',
          details: toErrorDetails(trtcError),
        });

      case 'MediaDeviceError':
        return new StreamingError(ErrorCode.MEDIA_DEVICE_ERROR, 'TRTC media device error', {
          provider: 'trtc',
          details: toErrorDetails(trtcError),
        });

      case 'PublishFailed':
        return new StreamingError(ErrorCode.TRACK_PUBLISH_FAILED, 'Failed to publish stream to TRTC', {
          provider: 'trtc',
          details: toErrorDetails(trtcError),
        });

      case 'UnpublishFailed':
        return new StreamingError(ErrorCode.TRACK_UNPUBLISH_FAILED, 'Failed to unpublish stream from TRTC', {
          provider: 'trtc',
          details: toErrorDetails(trtcError),
        });

      default:
        return new StreamingError(ErrorCode.UNKNOWN_ERROR, error?.message || 'Unknown TRTC error', {
          provider: 'trtc',
          details: toErrorDetails(trtcError),
        });
    }
  }

  static mapGenericError(error: unknown, provider?: StreamProviderType): StreamingError {
    if (error instanceof StreamingError) {
      return error;
    }

    if (error instanceof Error) {
      return new StreamingError(ErrorCode.UNKNOWN_ERROR, error.message, {
        provider,
        details: { name: error.name, stack: error.stack },
      });
    }

    return new StreamingError(ErrorCode.UNKNOWN_ERROR, 'An unknown error occurred', {
      provider,
      details: toErrorDetails(error),
    });
  }

  static mapApiError(response: unknown): StreamingError {
    const apiResponse = response as { code?: number; msg?: string; message?: string };
    const code = apiResponse?.code;
    const message = apiResponse?.msg || apiResponse?.message || 'API request failed';

    if (code === 1001) {
      return new StreamingError(ErrorCode.INVALID_CREDENTIALS, 'Invalid API credentials', {
        details: toErrorDetails(response),
      });
    }

    if (code === 1002) {
      return new StreamingError(ErrorCode.INVALID_CONFIGURATION, 'Invalid configuration parameters', {
        details: toErrorDetails(response),
      });
    }

    return new StreamingError(ErrorCode.API_REQUEST_FAILED, message, { details: toErrorDetails(response) });
  }
}
