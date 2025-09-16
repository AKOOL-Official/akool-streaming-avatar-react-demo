import { StreamingProvider, StreamingCredentials } from '../types/provider.interfaces';
import { StreamProviderType } from '../types/streaming.types';
import { logger } from '../core/Logger';
import { StreamingError, ErrorCode } from '../types/error.types';

interface ProviderModule {
  createProvider: (credentials: StreamingCredentials) => StreamingProvider;
}

type ProviderLoader = () => Promise<ProviderModule>;

export class StreamingProviderFactory {
  private static instance: StreamingProviderFactory;
  private providerLoaders = new Map<StreamProviderType, ProviderLoader>();
  private loadedProviders = new Map<StreamProviderType, ProviderModule>();

  static getInstance(): StreamingProviderFactory {
    if (!StreamingProviderFactory.instance) {
      StreamingProviderFactory.instance = new StreamingProviderFactory();
    }
    return StreamingProviderFactory.instance;
  }

  constructor() {
    this.registerProviderLoaders();
  }

  private registerProviderLoaders(): void {
    // Register lazy loaders for each provider
    this.providerLoaders.set('agora', () => import('./agora'));
    this.providerLoaders.set('livekit', () => import('./livekit'));
    this.providerLoaders.set('trtc', () => import('./trtc'));
  }

  async createProvider(type: StreamProviderType, credentials: StreamingCredentials): Promise<StreamingProvider> {
    try {
      logger.info('Creating streaming provider', { type });

      const module = await this.loadProviderModule(type);

      // Create provider with credentials
      const provider = module.createProvider(credentials);

      logger.info('Streaming provider created successfully', { type });
      return provider;
    } catch (error) {
      logger.error('Failed to create streaming provider', { error, type });
      throw new StreamingError(
        ErrorCode.PROVIDER_INITIALIZATION_FAILED,
        `Failed to initialize ${type} provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          provider: type,
          details: error instanceof Error ? { message: error.message, stack: error.stack } : { error },
        },
      );
    }
  }

  async createProviderWithCredentials(
    type: StreamProviderType,
    credentials: StreamingCredentials,
  ): Promise<StreamingProvider> {
    const provider = await this.createProvider(type, credentials);

    // Additional setup specific to provider type
    await this.setupProvider(provider, credentials);

    return provider;
  }

  private async loadProviderModule(type: StreamProviderType): Promise<ProviderModule> {
    // Check if already loaded
    if (this.loadedProviders.has(type)) {
      return this.loadedProviders.get(type)!;
    }

    // Get loader
    const loader = this.providerLoaders.get(type);
    if (!loader) {
      throw new StreamingError(ErrorCode.PROVIDER_NOT_SUPPORTED, `Provider type '${type}' is not supported`);
    }

    // Load module
    const module = await loader();
    this.loadedProviders.set(type, module);

    return module;
  }

  private async setupProvider(provider: StreamingProvider, credentials: StreamingCredentials): Promise<void> {
    // Perform any common provider setup
    logger.debug('Setting up provider', {
      type: provider.providerType,
      channelName: credentials.channelName,
    });

    // Could add common initialization logic here
  }

  isProviderSupported(type: StreamProviderType): boolean {
    return this.providerLoaders.has(type);
  }

  getSupportedProviders(): StreamProviderType[] {
    return Array.from(this.providerLoaders.keys());
  }
}

export const providerFactory = StreamingProviderFactory.getInstance();
