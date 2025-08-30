import { Room } from 'livekit-client';
import { RTCClient } from '../agoraHelper';
import {
  StreamingProvider,
  StreamProviderType,
  StreamingProviderFactory,
  ProviderConfig,
} from '../types/streamingProvider';
import { AgoraStreamingProvider } from './AgoraProvider';
import { LiveKitStreamingProvider } from './LiveKitProvider';

export class DefaultStreamingProviderFactory implements StreamingProviderFactory {
  private agoraClient?: RTCClient;
  private livekitRoom?: Room;
  private config: ProviderConfig;
  private currentProvider?: StreamingProvider;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  public async createProvider(type: StreamProviderType): Promise<StreamingProvider> {
    // Only cleanup if we're actually switching provider types
    if (this.currentProvider) {
      const currentType = this.currentProvider.providerType;
      if (currentType === type) {
        console.log('Provider type', type, 'already exists, reusing existing provider');
        return this.currentProvider;
      }

      console.log('Switching provider from', currentType, 'to', type, '- cleaning up existing provider');
      await this.currentProvider.cleanup();
      this.currentProvider = undefined;
    }

    let provider: StreamingProvider;

    switch (type) {
      case 'agora':
        if (!this.agoraClient) {
          throw new Error('Agora client not initialized. Call setAgoraClient() first.');
        }
        provider = new AgoraStreamingProvider(this.agoraClient);
        break;

      case 'livekit':
        if (!this.livekitRoom) {
          throw new Error('LiveKit room not initialized. Call setLiveKitRoom() first.');
        }
        provider = new LiveKitStreamingProvider(this.livekitRoom);
        break;

      case 'trtc':
        throw new Error('TRTC provider not implemented yet');

      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }

    this.currentProvider = provider;
    return provider;
  }

  public getSupportedProviders(): StreamProviderType[] {
    return ['agora', 'livekit']; // 'trtc' will be added later
  }

  public setAgoraClient(client: RTCClient): void {
    this.agoraClient = client;
  }

  public setLiveKitRoom(room: Room): void {
    this.livekitRoom = room;
  }

  public updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): ProviderConfig {
    return { ...this.config };
  }

  public async cleanupCurrentProvider(): Promise<void> {
    if (this.currentProvider) {
      await this.currentProvider.cleanup();
      this.currentProvider = undefined;
    }
  }
}

// Singleton factory instance
let factoryInstance: DefaultStreamingProviderFactory | null = null;

export function getStreamingProviderFactory(): DefaultStreamingProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new DefaultStreamingProviderFactory();
  }
  return factoryInstance;
}

export async function resetStreamingProviderFactory(): Promise<void> {
  if (factoryInstance) {
    await factoryInstance.cleanupCurrentProvider();
  }
  factoryInstance = null;
}
