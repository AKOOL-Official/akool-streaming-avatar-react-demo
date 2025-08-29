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

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  public createProvider(type: StreamProviderType): StreamingProvider {
    switch (type) {
      case 'agora':
        if (!this.agoraClient) {
          throw new Error('Agora client not initialized. Call setAgoraClient() first.');
        }
        return new AgoraStreamingProvider(this.agoraClient);

      case 'livekit':
        if (!this.livekitRoom) {
          throw new Error('LiveKit room not initialized. Call setLiveKitRoom() first.');
        }
        return new LiveKitStreamingProvider(this.livekitRoom);

      case 'trtc':
        throw new Error('TRTC provider not implemented yet');

      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
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
}

// Singleton factory instance
let factoryInstance: DefaultStreamingProviderFactory | null = null;

export function getStreamingProviderFactory(): DefaultStreamingProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new DefaultStreamingProviderFactory();
  }
  return factoryInstance;
}

export function resetStreamingProviderFactory(): void {
  factoryInstance = null;
}
