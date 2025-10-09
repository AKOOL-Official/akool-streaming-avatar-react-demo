import { BaseErrorHandler } from '../../../core/BaseErrorHandler';
import { ErrorCallbackConfig, ErrorHandlingConfig } from '../../../types/error.types';
import { logger } from '../../../core/Logger';

/**
 * Base controller class that provides common functionality
 * and error handling for all streaming controllers
 */
export abstract class BaseController extends BaseErrorHandler {
  protected isInitialized: boolean = false;
  protected isDestroyed: boolean = false;
  protected errorHandlingConfig: ErrorHandlingConfig;

  constructor(errorHandlingConfig: ErrorHandlingConfig = {}) {
    super();
    this.errorHandlingConfig = {
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableLogging: true,
      enableMetrics: false,
      ...errorHandlingConfig,
    };
  }

  /**
   * Initialize the controller
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Controller already initialized', { controller: this.constructor.name });
      return;
    }

    try {
      await this.onInitialize();
      this.isInitialized = true;
      logger.info('Controller initialized successfully', { controller: this.constructor.name });
    } catch (error) {
      this.handleError(error, this.constructor.name, 'initialize');
      throw error;
    }
  }

  /**
   * Destroy the controller and clean up resources
   */
  public async destroy(): Promise<void> {
    if (this.isDestroyed) {
      logger.warn('Controller already destroyed', { controller: this.constructor.name });
      return;
    }

    try {
      await this.onDestroy();
      this.cleanupErrorHandling();
      this.isDestroyed = true;
      logger.info('Controller destroyed successfully', { controller: this.constructor.name });
    } catch (error) {
      this.handleError(error, this.constructor.name, 'destroy');
      throw error;
    }
  }

  /**
   * Set error callbacks for this controller
   */
  public setErrorCallbacks(callbacks: ErrorCallbackConfig): void {
    if (callbacks.onError) {
      this.registerErrorCallback('global', callbacks.onError);
    }
    if (callbacks.onConnectionError) {
      this.registerErrorCallback('connection', callbacks.onConnectionError);
    }
    if (callbacks.onMediaError) {
      this.registerErrorCallback('media', callbacks.onMediaError);
    }
    if (callbacks.onNetworkError) {
      this.registerErrorCallback('network', callbacks.onNetworkError);
    }
    if (callbacks.onAuthError) {
      this.registerErrorCallback('auth', callbacks.onAuthError);
    }
  }

  /**
   * Execute an operation with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    operationName: string,
    maxRetries?: number,
  ): Promise<T | null> {
    const retries = maxRetries ?? this.errorHandlingConfig.maxRetries ?? 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          const delay = (this.errorHandlingConfig.retryDelay ?? 1000) * Math.pow(2, attempt);
          logger.warn(`Operation failed, retrying in ${delay}ms`, {
            context,
            operation: operationName,
            attempt: attempt + 1,
            maxRetries: retries,
            error: error instanceof Error ? error.message : String(error),
          });

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    this.handleError(lastError, context, operationName, {
      maxRetries: retries,
      finalAttempt: true,
    });

    return null;
  }

  /**
   * Check if the controller is in a valid state for operations
   */
  protected validateState(operation: string): boolean {
    if (this.isDestroyed) {
      logger.error('Operation attempted on destroyed controller', {
        controller: this.constructor.name,
        operation,
      });
      return false;
    }

    if (!this.isInitialized) {
      logger.error('Operation attempted on uninitialized controller', {
        controller: this.constructor.name,
        operation,
      });
      return false;
    }

    return true;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;

  /**
   * Getters for controller state
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  public get destroyed(): boolean {
    return this.isDestroyed;
  }
}
