import { StreamingProvider, StreamingCredentials, StreamingEventHandlers } from '../types/provider.interfaces';
import { StreamProviderType, StreamingState } from '../types/streaming.types';
import { StreamingProviderFactory } from './StreamingProviderFactory';
import { logger } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { StreamingError, ErrorCode } from '../types/error.types';

export class ProviderManager {
  private static instance: ProviderManager;
  private currentProvider: StreamingProvider | null = null;
  private currentProviderType: StreamProviderType | null = null;
  private eventBus = new EventBus();
  private providerFactory = StreamingProviderFactory.getInstance();

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  async switchProvider(
    type: StreamProviderType,
    credentials: StreamingCredentials,
    handlers?: StreamingEventHandlers,
  ): Promise<void> {
    logger.info('Switching streaming provider', {
      from: this.currentProviderType,
      to: type,
    });

    try {
      // Disconnect current provider if any
      if (this.currentProvider) {
        await this.currentProvider.disconnect();
      }

      // Create new provider
      const newProvider = await this.providerFactory.createProviderWithCredentials(type, credentials);

      // Set up state subscription
      newProvider.subscribe((state: StreamingState) => {
        this.eventBus.publish('system:info', {
          message: 'provider-state-changed',
          context: { provider: type, state },
        });
      });

      // Connect new provider
      await newProvider.connect(credentials, handlers);

      // Update current provider
      this.currentProvider = newProvider;
      this.currentProviderType = type;

      this.eventBus.publish('system:info', {
        message: 'provider-switched',
        context: { type, provider: newProvider },
      });

      logger.info('Provider switch completed successfully', { type });
    } catch (error) {
      logger.error('Provider switch failed', { error, type });
      const streamingError =
        error instanceof StreamingError
          ? error
          : new StreamingError(ErrorCode.UNKNOWN_ERROR, 'Provider switch failed', { provider: type });
      this.eventBus.publish('system:error', {
        error: streamingError,
      });
      throw error;
    }
  }

  getCurrentProvider(): StreamingProvider | null {
    return this.currentProvider;
  }

  getCurrentProviderType(): StreamProviderType | null {
    return this.currentProviderType;
  }

  getCurrentState(): StreamingState | null {
    return this.currentProvider?.state || null;
  }

  subscribe(event: string, callback: (data: unknown) => void): () => void {
    return this.eventBus.subscribe('system:info', (data) => {
      if (data.message === event) {
        callback(data.context);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.currentProvider) {
      await this.currentProvider.disconnect();
      this.currentProvider = null;
      this.currentProviderType = null;
    }
  }

  isProviderSupported(type: StreamProviderType): boolean {
    return this.providerFactory.isProviderSupported(type);
  }

  getSupportedProviders(): StreamProviderType[] {
    return this.providerFactory.getSupportedProviders();
  }
}

export const providerManager = ProviderManager.getInstance();
