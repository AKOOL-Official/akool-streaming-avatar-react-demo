import { RemoteVideoStrategy } from './RemoteVideoStrategy';
import { AgoraRemoteVideoStrategy } from '../../agora/strategies/AgoraRemoteVideoStrategy';
import { LiveKitRemoteVideoStrategy } from '../../livekit/strategies/LiveKitRemoteVideoStrategy';
import { TRTCRemoteVideoStrategy } from '../../trtc/strategies/TRTCRemoteVideoStrategy';
import { StreamProviderType } from '../../../types/streaming.types';

export class RemoteVideoStrategyFactory {
  private static strategies: Map<StreamProviderType, RemoteVideoStrategy> = new Map([
    ['agora', new AgoraRemoteVideoStrategy()],
    ['livekit', new LiveKitRemoteVideoStrategy()],
    ['trtc', new TRTCRemoteVideoStrategy()],
  ]);

  static getStrategy(providerType: StreamProviderType): RemoteVideoStrategy {
    const strategy = this.strategies.get(providerType);
    if (!strategy) {
      throw new Error(`No remote video strategy found for provider type: ${providerType}`);
    }
    return strategy;
  }

  static isProviderSupported(providerType: StreamProviderType): boolean {
    return this.strategies.has(providerType);
  }
}
