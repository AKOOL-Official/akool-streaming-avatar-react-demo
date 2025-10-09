import { logger } from './Logger';
import { StreamingError, ErrorCode } from '../types/error.types';

/**
 * Base error handler class providing common error handling patterns
 * for all streaming controllers and providers
 */
export abstract class BaseErrorHandler {
  protected errorCallbacks: Map<string, (error: StreamingError) => void> = new Map();

  /**
   * Register an error callback for a specific context
   */
  protected registerErrorCallback(context: string, callback: (error: StreamingError) => void): void {
    this.errorCallbacks.set(context, callback);
  }

  /**
   * Handle and log errors with context information
   */
  public handleError(
    error: unknown,
    context: string,
    operation: string,
    additionalInfo?: Record<string, unknown>,
  ): StreamingError {
    const streamingError = this.normalizeError(error, context, operation);

    // Log the error with context
    logger.error(`Error in ${context}.${operation}`, {
      error: streamingError.message,
      code: streamingError.code,
      context,
      operation,
      ...additionalInfo,
    });

    // Notify registered callbacks
    this.notifyErrorCallbacks(streamingError, context);

    return streamingError;
  }

  /**
   * Handle async operations with automatic error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    operationName: string,
    additionalInfo?: Record<string, unknown>,
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context, operationName, additionalInfo);
      return null;
    }
  }

  /**
   * Handle sync operations with automatic error handling
   */
  protected executeSyncWithErrorHandling<T>(
    operation: () => T,
    context: string,
    operationName: string,
    additionalInfo?: Record<string, unknown>,
  ): T | null {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, context, operationName, additionalInfo);
      return null;
    }
  }

  /**
   * Normalize different error types into StreamingError
   */
  private normalizeError(error: unknown, context: string, operation: string): StreamingError {
    if (error instanceof StreamingError) {
      return error;
    }

    if (error instanceof Error) {
      return new StreamingError(ErrorCode.UNKNOWN_ERROR, error.message, {
        originalError: error.name,
        context,
        operation,
      });
    }

    if (typeof error === 'string') {
      return new StreamingError(ErrorCode.UNKNOWN_ERROR, error, {
        context,
        operation,
      });
    }

    return new StreamingError(ErrorCode.UNKNOWN_ERROR, 'An unknown error occurred', {
      context,
      operation,
      originalError: String(error),
    });
  }

  /**
   * Notify all registered error callbacks
   */
  private notifyErrorCallbacks(error: StreamingError, context: string): void {
    // Notify context-specific callback
    const contextCallback = this.errorCallbacks.get(context);
    if (contextCallback) {
      try {
        contextCallback(error);
      } catch (callbackError) {
        logger.error('Error in error callback', {
          callbackError: callbackError instanceof Error ? callbackError.message : String(callbackError),
          originalError: error.message,
          context,
        });
      }
    }

    // Notify global error callback
    const globalCallback = this.errorCallbacks.get('global');
    if (globalCallback && context !== 'global') {
      try {
        globalCallback(error);
      } catch (callbackError) {
        logger.error('Error in global error callback', {
          callbackError: callbackError instanceof Error ? callbackError.message : String(callbackError),
          originalError: error.message,
        });
      }
    }
  }

  /**
   * Clean up error callbacks
   */
  protected cleanupErrorHandling(): void {
    this.errorCallbacks.clear();
  }
}

/**
 * Error handling decorator for async methods
 */
export function withErrorHandling(context: string, operationName: string, additionalInfo?: Record<string, unknown>) {
  return function (_target: unknown, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        if (this instanceof BaseErrorHandler) {
          this.handleError(error, context, operationName, additionalInfo);
        } else {
          logger.error(`Error in ${context}.${operationName}`, {
            error: error instanceof Error ? error.message : String(error),
            ...additionalInfo,
          });
        }
        throw error;
      }
    };
  };
}

/**
 * Error handling decorator for sync methods
 */
export function withSyncErrorHandling(
  context: string,
  operationName: string,
  additionalInfo?: Record<string, unknown>,
) {
  return function (_target: unknown, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = function (...args: unknown[]) {
      try {
        return method.apply(this, args);
      } catch (error) {
        if (this instanceof BaseErrorHandler) {
          this.handleError(error, context, operationName, additionalInfo);
        } else {
          logger.error(`Error in ${context}.${operationName}`, {
            error: error instanceof Error ? error.message : String(error),
            ...additionalInfo,
          });
        }
        throw error;
      }
    };
  };
}
